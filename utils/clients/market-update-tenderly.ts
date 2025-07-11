import { defaultAbiCoder } from '@ethersproject/abi'
import { getAddress } from '@ethersproject/address'
import { BigNumber, BigNumberish } from '@ethersproject/bignumber'
import { hexStripZeros } from '@ethersproject/bytes'
import { HashZero, Zero } from '@ethersproject/constants'
import { keccak256 } from '@ethersproject/keccak256'
import { toUtf8Bytes } from '@ethersproject/strings'
import { writeFileSync } from 'fs'
import mftch, { FETCH_OPT } from 'micro-ftch'
import {
  BridgedSimulation,
  ConfigWithoutGovernorType,
  ProposalEvent,
  ProposalStruct,
  SimulationConfig,
  SimulationConfigExecuted,
  SimulationConfigNew,
  SimulationConfigProposed,
  SimulationResult,
  StorageEncodingResponse,
  TenderlyBundledSimulation,
  TenderlyContract,
  TenderlyPayload,
  TenderlySimulation,
} from '../../types'
import { customProvider } from '../../utils/clients/ethers'
import {
  BLOCK_GAS_LIMIT,
  TENDERLY_ACCESS_TOKEN,
  TENDERLY_BASE_URL,
  TENDERLY_ENCODE_URL,
  TENDERLY_SIM_BUNDLE_URL,
  TENDERLY_SIM_URL,
} from '../constants'
import {
  generateProposalId,
  getProposer,
  getProposal,
  getProposalId,
  getTimelock,
} from '../contracts/market-update-proposer'
import { CometChains, ExecuteTransactionInfo } from './../../checks/compound/compound-types'
import {
  ChainAddresses,
  getBridgeReceiverInput,
  getBridgeReceiverOverrides,
  getDecodedBytesForChain,
  l2Bridges,
  l2ChainIdMap,
  l2ChainSenderMap,
} from './../../checks/compound/l2-utils'
import { bridgeReceiver } from './../contracts/baseBridgeReceiver'
import { capitalizeWord } from './../../checks/compound/formatters/helper'
import { Block } from '@ethersproject/abstract-provider'
import { JsonRpcProvider } from '@ethersproject/providers'

// @ts-ignore
const fetchUrl = mftch.default

const TENDERLY_FETCH_OPTIONS = { type: 'json', headers: { 'X-Access-Key': TENDERLY_ACCESS_TOKEN } }
const DEFAULT_FROM = '0xD73a92Be73EfbFcF3854433A5FcbAbF9c1316073' // arbitrary EOA not used on-chain

// --- Simulation methods ---

/**
 * @notice Simulates a proposal based on the provided configuration
 * @param config Configuration object
 */
export async function simulate(config: ConfigWithoutGovernorType, provider: JsonRpcProvider, chain: CometChains) {
  if (config.type === 'executed') {
    console.log(`Simulating executed proposal:`, config)
    return await simulateExecuted(config as SimulationConfigExecuted, provider, chain)
  } else if (config.type === 'proposed') {
    console.log(`Simulating proposed proposal:`, config)
    return await simulateProposed(config as SimulationConfigProposed, provider, chain)
  } else {
    console.log(`Simulating new proposal:`, config)
    return await simulateNew(config as SimulationConfigNew, provider, chain)
  }
}

/**
 * @notice Simulates execution of an on-chain proposal that has not yet been executed
 * @param config Configuration object
 */
async function simulateNew(
  config: SimulationConfigNew,
  provider: JsonRpcProvider,
  chain: CometChains,
): Promise<SimulationResult> {
  // --- Validate config ---
  const { governorAddress, targets, values, signatures, calldatas, description } = config
  if (targets.length !== values.length) throw new Error('targets and values must be the same length')
  if (targets.length !== signatures.length) throw new Error('targets and signatures must be the same length')
  if (targets.length !== calldatas.length) throw new Error('targets and calldatas must be the same length')

  // --- Get details about the proposal we're simulating ---
  const network = await provider.getNetwork()
  const blockNumberToUse = (await getLatestBlock(network.chainId)) - 3 // subtracting a few blocks to ensure tenderly has the block
  const latestBlock = await provider.getBlock(blockNumberToUse)
  const governor = getProposer(governorAddress, provider)

  const [proposalId, timelock] = await Promise.all([
    generateProposalId(governorAddress, provider),
    getTimelock(governorAddress, provider),
  ])

  const startBlock = BigNumber.from(latestBlock.number - 100) // arbitrarily subtract 100
  const proposal: ProposalEvent = {
    id: proposalId,
    proposalId,
    proposer: DEFAULT_FROM,
    startBlock,
    endBlock: startBlock.add(1),
    description,
    targets,
    values: values.map(BigNumber.from),
    signatures,
    calldatas,
  }

  // --- Prepare simulation configuration ---
  // Set `from` arbitrarily.
  const from = DEFAULT_FROM

  // Run simulation at the block right after the proposal ends.
  const simBlock = proposal.endBlock!.add(1)

  // For OZ governors we arbitrarily choose execution time. For Bravo governors, we
  // compute the approximate earliest possible execution time based on governance parameters. This
  // can only be approximate because voting period is defined in blocks, not as a timestamp. We
  // assume 12 second block times to prefer underestimating timestamp rather than overestimating,
  // and we prefer underestimating to avoid simulations reverting in cases where governance
  // proposals call methods that pass in a start timestamp that must be lower than the current
  // block timestamp (represented by the `simTimestamp` variable below)
  const simTimestamp = BigNumber.from(latestBlock.timestamp).add(simBlock.sub(proposal.endBlock!).mul(12))
  const eta = simTimestamp // set proposal eta to be equal to the timestamp we simulate at

  // Compute transaction hashes used by the Timelock
  const txHashes = targets.map((target, i) => {
    const [val, sig, calldata] = [values[i], signatures[i], calldatas[i]]
    return keccak256(
      defaultAbiCoder.encode(['address', 'uint256', 'string', 'bytes', 'uint256'], [target, val, sig, calldata, eta]),
    )
  })

  // Generate the state object needed to mark the transactions as queued in the Timelock's storage
  const timelockStorageObj: Record<string, string> = {}
  txHashes.forEach((hash) => {
    timelockStorageObj[`queuedTransactions[${hash}]`] = 'true'
  })

  // Use the Tenderly API to get the encoded state overrides for governor storage
  let governorStateOverrides: Record<string, string> = {}
  const proposalKey = `proposals[${proposalId.toString()}]`
  governorStateOverrides = {
    proposalCount: proposalId.toString(),
    [`${proposalKey}.id`]: proposalId.toString(),
    [`${proposalKey}.proposer`]: DEFAULT_FROM,
    [`${proposalKey}.eta`]: eta.toString(),
    [`${proposalKey}.canceled`]: 'false',
    [`${proposalKey}.executed`]: 'false',
  }

  targets.forEach((target, i) => {
    const value = BigNumber.from(values[i]).toString()
    governorStateOverrides[`${proposalKey}.targets[${i}]`] = target
    governorStateOverrides[`${proposalKey}.values[${i}]`] = value
    governorStateOverrides[`${proposalKey}.signatures[${i}]`] = signatures[i]
    governorStateOverrides[`${proposalKey}.calldatas[${i}]`] = calldatas[i]
  })

  const stateOverrides = {
    networkID: String(network.chainId),
    stateOverrides: {
      [timelock.address]: {
        value: timelockStorageObj,
      },
      [governor.address]: {
        value: governorStateOverrides,
      },
    },
  }

  const storageObj = await sendEncodeRequest(stateOverrides)

  // --- Simulate it ---
  // We need the following state conditions to be true to successfully simulate a proposal:
  //   - proposalCount >= proposal.id
  //   - proposal.canceled == false
  //   - proposal.executed == false
  //   - proposal.eta !== 0
  //   - block.timestamp >= proposal.eta
  //   - block.timestamp <  proposal.eta + timelock.GRACE_PERIOD()
  //   - queuedTransactions[txHash] = true for each action in the proposal
  const executeInputs = [proposalId.toString()]
  const simulationPayload: TenderlyPayload = {
    network_id: String(network.chainId) as TenderlyPayload['network_id'],
    // this field represents the block state to simulate against, so we use the latest block number
    block_number: latestBlock.number,
    from: DEFAULT_FROM,
    to: governor.address,
    input: governor.interface.encodeFunctionData('execute', executeInputs),
    gas: BLOCK_GAS_LIMIT,
    gas_price: '0',
    value: '0', // TODO Support sending ETH in local simulations like we do below in `simulateProposed`.
    save_if_fails: false, // Set to true to save the simulation to your Tenderly dashboard if it fails.
    save: false, // Set to true to save the simulation to your Tenderly dashboard if it succeeds.
    generate_access_list: true, // not required, but useful as a sanity check to ensure consistency in the simulation response
    block_header: {
      // this data represents what block.number and block.timestamp should return in the EVM during the simulation
      number: hexStripZeros(simBlock.toHexString()),
      timestamp: hexStripZeros(simTimestamp.toHexString()),
    },
    state_objects: {
      // Since gas price is zero, the sender needs no balance.
      // TODO Support sending ETH in local simulations like we do below in `simulateProposed`.
      [from]: { balance: '0' },
      // Ensure transactions are queued in the timelock
      [timelock.address]: { storage: storageObj.stateOverrides[timelock.address.toLowerCase()].value },
      // Ensure governor storage is properly configured so `state(proposalId)` returns `Queued`
      [governor.address]: { storage: storageObj.stateOverrides[governor.address.toLowerCase()].value },
    },
  }
  const sim = await sendSimulation(simulationPayload)
  writeFileSync('new-response.json', JSON.stringify(sim, null, 2))
  return { sim, proposal, latestBlock }
}

/**
 * @notice Simulates execution of an on-chain proposal that has not yet been executed
 * @param config Configuration object
 */
async function simulateProposed(
  config: SimulationConfigProposed,
  provider: JsonRpcProvider,
  chain: CometChains,
): Promise<SimulationResult> {
  const { governorAddress, proposalId } = config

  // --- Get details about the proposal we're simulating ---
  const network = await provider.getNetwork()
  const blockNumberToUse = (await getLatestBlock(network.chainId)) - 3 // subtracting a few blocks to ensure tenderly has the block
  const latestBlock = await provider.getBlock(blockNumberToUse)
  const blockRange = [0, latestBlock.number]
  const governor = getProposer(governorAddress, provider)

  const [_proposal, proposalCreatedLogs, timelock] = await Promise.all([
    getProposal(governorAddress, proposalId, provider),
    governor.queryFilter(governor.filters.MarketUpdateProposalCreated(), ...blockRange),
    getTimelock(governorAddress, provider),
  ])
  const proposal = <ProposalStruct>_proposal

  const proposalCreatedEventWrapper = proposalCreatedLogs.filter((log) => {
    return getProposalId(log.args as unknown as ProposalEvent).eq(proposalId)
  })[0]
  if (!proposalCreatedEventWrapper)
    throw new Error(`Proposal creation log for #${proposalId} not found in proposer logs`)
  const proposalCreatedEvent = proposalCreatedEventWrapper.args as unknown as ProposalEvent
  const { targets, signatures: sigs, calldatas } = proposalCreatedEvent

  // Workaround an issue that ethers cannot decode the values properly.
  // We know that the values are the 4th parameter in
  // `MarketUpdateProposalCreated(proposalId, proposer, targets, values, signatures, calldatas, description)`
  const values: BigNumber[] = proposalCreatedEventWrapper.args![3]

  // --- Prepare simulation configuration ---
  // We need the following state conditions to be true to successfully simulate a proposal:
  //   - proposal.canceled == false
  //   - proposal.executed == false
  //   - proposal.eta !== 0
  //   - block.timestamp >= proposal.eta
  //   - block.timestamp <  proposal.eta + timelock.GRACE_PERIOD()
  //   - queuedTransactions[txHash] = true for each action in the proposal

  // Set `from` arbitrarily.
  const from = DEFAULT_FROM

  const simBlock = proposal.endBlock!.add(1)

  // For OZ governors we are given the earliest possible execution time. For Bravo governors, we
  // Compute the approximate earliest possible execution time based on governance parameters. This
  // can only be approximate because voting period is defined in blocks, not as a timestamp. We
  // assume 12 second block times to prefer underestimating timestamp rather than overestimating,
  // and we prefer underestimating to avoid simulations reverting in cases where governance
  // proposals call methods that pass in a start timestamp that must be lower than the current
  // block timestamp (represented by the `simTimestamp` variable below)
  const simTimestamp = BigNumber.from(latestBlock.timestamp).add(simBlock.sub(proposal.endBlock!).mul(12))
  const eta = simTimestamp // set proposal eta to be equal to the timestamp we simulate at

  // Compute transaction hashes used by the Timelock
  const txHashes = targets.map((target, i) => {
    const [val, sig, calldata] = [values[i], sigs[i], calldatas[i]]
    return keccak256(
      defaultAbiCoder.encode(['address', 'uint256', 'string', 'bytes', 'uint256'], [target, val, sig, calldata, eta]),
    )
  })

  // Generate the state object needed to mark the transactions as queued in the Timelock's storage
  const timelockStorageObj: Record<string, string> = {}
  txHashes.forEach((hash) => {
    timelockStorageObj[`queuedTransactions[${hash}]`] = 'true'
  })

  const proposalIdBn = BigNumber.from(proposalId)
  let governorStateOverrides: Record<string, string> = {}
  const proposalKey = `proposals[${proposalIdBn.toString()}]`
  governorStateOverrides = {
    proposalCount: proposalId.toString(),
    [`${proposalKey}.eta`]: eta.toString(),
    [`${proposalKey}.canceled`]: 'false',
    [`${proposalKey}.executed`]: 'false',
  }

  const stateOverrides = {
    networkID: String(network.chainId),
    stateOverrides: {
      [timelock.address]: {
        value: timelockStorageObj,
      },
      [governor.address]: {
        value: governorStateOverrides,
      },
    },
  }
  const storageObj = await sendEncodeRequest(stateOverrides)

  // --- Simulate it ---
  // Note: The Tenderly API is sensitive to the input types, so all formatting below (e.g. stripping
  // leading zeroes, padding with zeros, strings vs. hex, etc.) are all intentional decisions to
  // ensure Tenderly properly parses the simulation payload
  const executeInputs = [proposalId.toString()]

  let simulationPayload: TenderlyPayload = {
    network_id: String(network.chainId) as TenderlyPayload['network_id'],
    // this field represents the block state to simulate against, so we use the latest block number
    block_number: latestBlock.number,
    from,
    to: governor.address,
    input: governor.interface.encodeFunctionData('execute', executeInputs),
    gas: BLOCK_GAS_LIMIT,
    gas_price: '0',
    value: '0',
    save_if_fails: false, // Set to true to save the simulation to your Tenderly dashboard if it fails.
    save: false, // Set to true to save the simulation to your Tenderly dashboard if it succeeds.
    generate_access_list: true, // not required, but useful as a sanity check to ensure consistency in the simulation response
    block_header: {
      // this data represents what block.number and block.timestamp should return in the EVM during the simulation
      number: hexStripZeros(simBlock.toHexString()),
      timestamp: hexStripZeros(simTimestamp.toHexString()),
    },
    state_objects: {
      // Since gas price is zero, the sender needs no balance. If the sender does need a balance to
      // send ETH with the execution, this will be overridden later.
      [from]: { balance: '0' },
      // Ensure transactions are queued in the timelock
      [timelock.address]: { storage: storageObj.stateOverrides[timelock.address.toLowerCase()].value },
      // Ensure governor storage is properly configured so `state(proposalId)` returns `Queued`
      [governor.address]: { storage: storageObj.stateOverrides[governor.address.toLowerCase()].value },
    },
  }
  const startBlock = BigNumber.from(latestBlock.number)

  const formattedProposal: ProposalEvent = {
    ...proposalCreatedEvent,
    startBlock,
    endBlock: startBlock.add(1),
    values, // This does not get included otherwise, same reason why we use `proposalCreatedEvent.args![3]` above.
    id: BigNumber.from(proposalId), // Make sure we always have an ID field
  }

  let sim = await sendSimulation(simulationPayload)
  const bridgedSimulations = await simulateBridgedTransactions(chain, config.proposalId, proposalCreatedEvent)
  const totalValue = values.reduce((sum, cur) => sum.add(cur), Zero)

  // Sim succeeded, or failure was not due to an ETH balance issue, so return the simulation.
  if (sim.simulation.status || totalValue.eq(Zero))
    return { sim: { ...sim, bridgedSimulations }, proposal: formattedProposal, latestBlock }

  // Simulation failed, try again by setting value to the difference between total call values and governor ETH balance.
  const governorEthBalance = await provider.getBalance(governor.address)
  const newValue = totalValue.sub(governorEthBalance).toString()
  simulationPayload.value = newValue
  simulationPayload.state_objects![from].balance = newValue
  sim = await sendSimulation(simulationPayload)
  if (sim.simulation.status) return { sim: { ...sim, bridgedSimulations }, proposal: formattedProposal, latestBlock }

  // Simulation failed, try again by setting value to the total call values.
  simulationPayload.value = totalValue.toString()
  simulationPayload.state_objects![from].balance = totalValue.toString()
  sim = await sendSimulation(simulationPayload)

  return { sim: { ...sim, bridgedSimulations }, proposal: formattedProposal, latestBlock }
}

/**
 * @notice Simulates execution of an already-executed governance proposal
 * @param config Configuration object
 */
async function simulateExecuted(
  config: SimulationConfigExecuted,
  provider: JsonRpcProvider,
  chain: CometChains,
): Promise<SimulationResult> {
  const { governorAddress, proposalId } = config

  console.log(`Simulating executed proposal #${proposalId}...`)
  // --- Get details about the proposal we're analyzing ---
  const latestBlock = await provider.getBlock('latest')
  const blockRange = [0, latestBlock.number]
  const governor = getProposer(governorAddress, provider)

  const [proposalCreatedLogs, proposalExecutedLogs] = await Promise.all([
    governor.queryFilter(governor.filters.MarketUpdateProposalCreated(), ...blockRange),
    governor.queryFilter(governor.filters.MarketUpdateProposalExecuted(), ...blockRange),
  ])

  const proposalCreatedEvent = proposalCreatedLogs.filter((log) => {
    return getProposalId(log.args as unknown as ProposalEvent).eq(proposalId)
  })[0]
  if (!proposalCreatedEvent) throw new Error(`Proposal creation log for #${proposalId} not found in proposer logs`)
  const proposal = proposalCreatedEvent.args as unknown as ProposalEvent

  const proposalExecutedEvent = proposalExecutedLogs.filter((log) => {
    return getProposalId(log.args as unknown as ProposalEvent).eq(proposalId)
  })[0]
  if (!proposalExecutedEvent) throw new Error(`Proposal execution log for #${proposalId} not found in proposer logs`)

  // --- Simulate it ---
  // Prepare tenderly payload. Since this proposal was already executed, we directly use that transaction data
  const tx = await provider.getTransaction(proposalExecutedEvent.transactionHash)

  const simulationPayload: TenderlyPayload = {
    network_id: String(tx.chainId) as TenderlyPayload['network_id'],
    block_number: tx.blockNumber,
    from: tx.from,
    to: tx.to as string,
    input: tx.data,
    gas: tx.gasLimit.toNumber(),
    gas_price: tx.gasPrice?.toString(),
    value: tx.value.toString(),
    save_if_fails: false, // Set to true to save the simulation to your Tenderly dashboard if it fails.
    save: false, // Set to true to save the simulation to your Tenderly dashboard if it succeeds.
    generate_access_list: true,
  }

  const sim = await sendSimulation(simulationPayload)
  const startBlock = BigNumber.from(tx.blockNumber)

  const formattedProposal: ProposalEvent = {
    ...proposal,
    startBlock,
    endBlock: startBlock.add(1),
    id: BigNumber.from(proposalId), // Make sure we always have an ID field
    values: proposalCreatedEvent.args?.[3],
  }

  const bridgedSimulations = await simulateBridgedTransactions(chain, config.proposalId, proposal)
  console.log(`Bridge simulations: ${bridgedSimulations.length}`)
  return { sim: { ...sim, bridgedSimulations }, proposal: formattedProposal, latestBlock }
}

// --- Helper methods ---

// Sleep for the specified number of milliseconds
const sleep = (delay: number) => new Promise((resolve) => setTimeout(resolve, delay)) // delay in milliseconds

// Get a random integer between two values
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min) + min) // max is exclusive, min is inclusive

/**
 * @notice Given a Tenderly contract object, generates a descriptive human-friendly name for that contract
 * @param contract Tenderly contract object to generate name from
 */
export function getContractName(contract: TenderlyContract | undefined) {
  if (!contract) return 'unknown contract name'
  let contractName = contract?.contract_name

  // If the contract is a token, include the full token name. This is useful in cases where the
  // token is a proxy, so the contract name doesn't give much useful information
  if (contract?.token_data?.name) contractName += ` (${contract?.token_data?.name})`

  // Lastly, append the contract address and save it off
  return `${contractName} at \`${getAddress(contract.address)}\``
}

/**
 * Gets the latest block number known to Tenderly
 * @param chainId Chain ID to get block number for
 */
async function getLatestBlock(chainId: BigNumberish): Promise<number> {
  try {
    // Send simulation request
    const url = `${TENDERLY_BASE_URL}/network/${BigNumber.from(chainId).toString()}/block-number`
    const fetchOptions = <Partial<FETCH_OPT>>{ method: 'GET', ...TENDERLY_FETCH_OPTIONS }
    const res = await fetchUrl(url, fetchOptions)
    return res.block_number as number
  } catch (err) {
    console.log('logging getLatestBlock error')
    console.log(JSON.stringify(err, null, 2))
    throw err
  }
}

/**
 * @notice Encode state overrides
 * @param payload State overrides to send
 */
async function sendEncodeRequest(payload: any): Promise<StorageEncodingResponse> {
  try {
    const fetchOptions = <Partial<FETCH_OPT>>{
      method: 'POST',
      data: payload,
      ...TENDERLY_FETCH_OPTIONS,
    }
    const response = await fetchUrl(TENDERLY_ENCODE_URL, fetchOptions)

    return response as StorageEncodingResponse
  } catch (err) {
    console.log('logging sendEncodeRequest error')
    console.log(JSON.stringify(err, null, 2))
    console.log(JSON.stringify(payload))
    throw err
  }
}

/**
 * @notice Sends a transaction simulation request to the Tenderly API
 * @dev Uses a simple exponential backoff when requests fail, with the following parameters:
 *   - Initial delay is 1 second
 *   - We randomize the delay duration to avoid synchronization issues if client is sending multiple requests simultaneously
 *   - We double delay each time and throw an error if delay is over 8 seconds
 * @param payload Transaction simulation parameters
 * @param delay How long to wait until next simulation request after failure, in milliseconds
 */
async function sendSimulation(payload: TenderlyPayload, delay = 1000): Promise<TenderlySimulation> {
  const fetchOptions = <Partial<FETCH_OPT>>{ method: 'POST', data: payload, ...TENDERLY_FETCH_OPTIONS }
  try {
    // Send simulation request
    const sim = <TenderlySimulation>await fetchUrl(TENDERLY_SIM_URL, fetchOptions)

    // Post-processing to ensure addresses we use are checksummed (since ethers returns checksummed addresses)
    sim.transaction.addresses = sim.transaction.addresses.map(getAddress)
    sim.contracts.forEach((contract) => (contract.address = getAddress(contract.address)))
    return sim
  } catch (err: any) {
    console.log('err in sendSimulation: ', JSON.stringify(err))
    const is429 = typeof err === 'object' && err?.statusCode === 429
    if (delay > 8000 || !is429) {
      console.warn(`Market Update - Simulation request failed with the below request payload and error`)
      console.log(JSON.stringify(fetchOptions))
      throw err
    }
    console.warn(err)
    console.warn(
      `Market Update - Simulation request failed with the above error, retrying in ~${delay} milliseconds. See request payload below`,
    )
    console.log(JSON.stringify(payload))
    await sleep(delay + randomInt(0, 1000))
    return await sendSimulation(payload, delay * 2)
  }
}

async function simulateBridgedTransactions(
  sourceChain: CometChains,
  proposalId: BigNumberish,
  proposalEvent: ProposalEvent,
): Promise<BridgedSimulation[]> {
  const bridgedSims: BridgedSimulation[] = []

  // --- Detect and handle bridged transactions ---

  for (const [i, targetNoCase] of proposalEvent.targets.entries()) {
    const target = targetNoCase.toLowerCase()

    if (
      Object.keys(l2Bridges)
        .map((a) => a.toLowerCase())
        .includes(target.toLowerCase())
    ) {
      const destinationChain = l2Bridges[target]

      console.log(`Detected bridged transaction targeting ${target} on ${destinationChain}`)

      // TODO: Remove this check after Tenderly add support for Scroll
      if (destinationChain === CometChains.scroll) {
        console.log('Tenderly does not support simulating transactions on Scroll')
        continue
      }

      const transactionInfo: ExecuteTransactionInfo = {
        target: proposalEvent.targets[i],
        signature: proposalEvent.signatures[i],
        calldata: proposalEvent.calldatas[i],
        value: proposalEvent.values?.[i],
      }

      const networkId = l2ChainIdMap[destinationChain]

      const l2TransactionsInfo = await getDecodedBytesForChain(
        sourceChain,
        destinationChain,
        BigNumber.from(proposalId).toNumber(),
        transactionInfo,
      )

      // Create block and timestamp placeholders for the bridged chain
      const blockNumberToUse = (await getLatestBlock(networkId)) - 3 // subtracting a few blocks to ensure tenderly has the block
      const customChainProvider = customProvider(destinationChain)
      const latestBlock = await customChainProvider.getBlock(blockNumberToUse)
      const baseBridgeReceiver = bridgeReceiver(
        ChainAddresses.L2BridgeReceiver[destinationChain],
        customProvider(destinationChain),
      )

      const stateOverrides = getBridgeReceiverOverrides(destinationChain)
      const payloadSender = l2ChainSenderMap[destinationChain]
      const input = getBridgeReceiverInput(destinationChain, l2TransactionsInfo)
      const beforeProposalCount = ((await baseBridgeReceiver.callStatic.proposalCount()) as BigNumber).toNumber()
      // Mantle requires a higher gas limit
      const gas = destinationChain === CometChains.mantle ? 3000000000000 : BLOCK_GAS_LIMIT

      // Construct the payload for the bridged chain simulation
      const createProposalPayload: TenderlyPayload = {
        network_id: networkId as TenderlyPayload['network_id'],
        block_number: latestBlock.number,
        from: payloadSender,
        to: ChainAddresses.L2BridgeReceiver[destinationChain] as string,
        input: input,
        gas: gas,
        gas_price: '0', // Gas price can be adjusted based on chain requirements
        value: '0', // If the transaction sends ETH, adjust this field
        save_if_fails: false,
        save: false,
        generate_access_list: true,
        block_header: {
          number: hexStripZeros(BigNumber.from(latestBlock.number).toHexString()),
          timestamp: hexStripZeros(BigNumber.from(latestBlock.timestamp).toHexString()),
        },
        state_objects: stateOverrides, // Optionally add state overrides if required
      }
      const executeProposalPayload: TenderlyPayload = {
        network_id: networkId as TenderlyPayload['network_id'],
        block_number: latestBlock.number + 2,
        from: DEFAULT_FROM, // Use a default address because any address can execute the proposal
        to: ChainAddresses.L2BridgeReceiver[destinationChain],
        input: baseBridgeReceiver.interface.encodeFunctionData('executeProposal', [beforeProposalCount + 1]),
        gas: gas,
        gas_price: '0',
        value: '0',
        save_if_fails: false,
        save: false,
        generate_access_list: true,
        block_header: {
          number: hexStripZeros(BigNumber.from(latestBlock.number + 2).toHexString()),
          // Add 4 days to make sure the timelock has passed
          timestamp: hexStripZeros(BigNumber.from(latestBlock.timestamp + 4 * 24 * 60 * 60).toHexString()),
        },
      }

      const response = await sendBundleSimulation([createProposalPayload, executeProposalPayload])
      const proposal = createBridgeProposal(response, destinationChain, latestBlock)
      let result: BridgedSimulation = { chain: destinationChain, proposal, sim: response, success: true }

      for (const sim of response.simulation_results) {
        if (!sim.transaction) {
          result = { chain: destinationChain, success: false }
          break // Exit on the failed simulation
        }
        if (!sim.transaction.status) {
          result = { chain: destinationChain, sim: response, success: false }
          break // Exit on the first failed transaction
        }
      }
      bridgedSims.push(result)
    }
  }

  return bridgedSims
}

async function sendBundleSimulation(payload: TenderlyPayload[], delay = 1000): Promise<TenderlyBundledSimulation> {
  const fetchOptions = <Partial<FETCH_OPT>>{ method: 'POST', data: { simulations: payload }, ...TENDERLY_FETCH_OPTIONS }
  try {
    // Send simulation request
    const bundledSim = <TenderlyBundledSimulation>await fetchUrl(TENDERLY_SIM_BUNDLE_URL, fetchOptions)
    // Post-processing to ensure addresses we use are checksummed (since ethers returns checksummed addresses)
    bundledSim.simulation_results.forEach((sim) => {
      if (sim.transaction && sim.contracts.length > 0) {
        sim.transaction.addresses = sim.transaction.addresses.map(getAddress)
        sim.contracts.forEach((contract) => (contract.address = getAddress(contract.address)))
      }
    })
    return bundledSim
  } catch (err: any) {
    console.log('err in sendSimulation: ', JSON.stringify(err))
    const is429 = typeof err === 'object' && err?.statusCode === 429
    if (delay > 8000 || !is429) {
      console.warn(`Simulation request failed with the below request payload and error`)
      console.log(JSON.stringify(fetchOptions))
      throw err
    }
    console.warn(err)
    console.warn(
      `Simulation request failed with the above error, retrying in ~${delay} milliseconds. See request payload below`,
    )
    console.log(JSON.stringify(payload))
    await sleep(delay + randomInt(0, 1000))
    return await sendBundleSimulation(payload, delay * 2)
  }
}

function createBridgeProposal(
  bundledSimulation: TenderlyBundledSimulation,
  chain: CometChains,
  block: Block,
): ProposalEvent | undefined {
  // Extract logs from the first simulation result as the first payload creates the proposal
  const proposalCreatedLogs = bundledSimulation.simulation_results[0]?.transaction?.transaction_info?.logs

  // If no logs exist, return undefined
  if (!proposalCreatedLogs) {
    console.error('No logs found in simulation results')
    return undefined
  }

  // Find the "ProposalCreated" event in the logs
  const proposalCreatedEvent = proposalCreatedLogs.find((log) => log.name === 'ProposalCreated')

  if (!proposalCreatedEvent) {
    console.error('No ProposalCreated event found in logs')
    return undefined
  }

  // Initialize fields for ProposalEvent
  let targets: string[] = []
  let values: BigNumber[] = []
  let signatures: string[] = []
  let calldatas: string[] = []
  let proposalId: BigNumber = BigNumber.from(0)
  const description = `Proposal to ${capitalizeWord(chain)}`

  // Process the inputs of the "ProposalCreated" event
  proposalCreatedEvent.inputs.forEach((input) => {
    switch (input.soltype?.name) {
      case 'id':
        proposalId = BigNumber.from(input.value)
        break
      case 'targets':
        targets = input.value.map((target: string) => target.toString())
        break
      case 'values':
        values = input.value.map((value: string) => BigNumber.from(value))
        break
      case 'signatures':
        signatures = input.value.map((signature: string) => signature.toString())
        break
      case 'calldatas':
        calldatas = input.value.map((calldata: string) => calldata.toString())
        break
    }
  })

  if (!proposalId || targets.length === 0 || values.length === 0 || signatures.length === 0 || calldatas.length === 0) {
    console.error('Missing fields for ProposalEvent creation')
    return undefined
  }

  return {
    id: proposalId,
    proposer: '0x', // Replace with the actual proposer
    targets,
    values,
    signatures,
    calldatas,
    description,
    startBlock: BigNumber.from(block.number),
    endBlock: BigNumber.from(block.number + 2),
  }
}
