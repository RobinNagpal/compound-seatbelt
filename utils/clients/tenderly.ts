import { Block } from '@ethersproject/abstract-provider'
import { getAddress } from '@ethersproject/address'
import { BigNumber, BigNumberish } from '@ethersproject/bignumber'
import { hexStripZeros } from '@ethersproject/bytes'
import { Zero } from '@ethersproject/constants'
import { keccak256 } from '@ethersproject/keccak256'
import { toUtf8Bytes } from '@ethersproject/strings'
import { writeFileSync } from 'fs'
import {
  BridgedSimulation,
  ProposalEvent,
  ProposalStruct,
  SimulationConfig,
  SimulationConfigExecuted,
  SimulationConfigNew,
  SimulationConfigProposed,
  SimulationResult,
  TenderlyBundledSimulation,
  TenderlyContract,
  TenderlyPayload,
} from '../../types'
import { customProvider } from '../../utils/clients/ethers'
import { BLOCK_GAS_LIMIT } from '../constants'
import {
  generateProposalId,
  getGovernor,
  getProposal,
  getProposalId,
  getTimelock,
  getVotingToken,
} from '../contracts/governor'
import { CometChains, ExecuteTransactionInfo } from './../../checks/compound/compound-types'
import { capitalizeWord } from './../../checks/compound/formatters/helper'
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
import { provider } from './ethers'
import { getGovernorOverrides, GovernorOverrideParams } from './governor-overrides'
import {
  createSimulationPayload,
  getLatestBlock,
  sendBundleSimulation,
  sendEncodeRequest,
  sendSimulation,
  SimulationPayloadParams,
} from './tenderly-helpers'
import { generateTimelockOverrides, TimelockOverrideParams } from './timelock-overrides'

// Common constants

const DEFAULT_FROM = '0xD73a92Be73EfbFcF3854433A5FcbAbF9c1316073' // arbitrary EOA not used on-chain

// --- Utility functions ---

// --- Simulation Methods ---

/**
 * @notice Simulates a proposal based on the provided configuration
 * @param config Configuration object
 */
export async function simulate(config: SimulationConfig) {
  if (config.type === 'executed') return await simulateExecuted(config)
  else if (config.type === 'proposed') return await simulateProposed(config)
  else return await simulateNew(config)
}

/**
 * @notice Simulates execution of an on-chain proposal that has not yet been executed
 * @param config Configuration object
 */
async function simulateNew(config: SimulationConfigNew): Promise<SimulationResult> {
  console.log('Simulating new proposal...')
  // --- Validate config ---
  const { governorAddress, governorType, targets, values, signatures, calldatas, description } = config
  if (targets.length !== values.length) throw new Error('targets and values must be the same length')
  if (targets.length !== signatures.length) throw new Error('targets and signatures must be the same length')
  if (targets.length !== calldatas.length) throw new Error('targets and calldatas must be the same length')

  // --- Get details about the proposal we're simulating ---
  const network = await provider.getNetwork()
  const blockNumberToUse = (await getLatestBlock(network.chainId)) - 3 // subtracting a few blocks to ensure tenderly has the block
  const latestBlock = await provider.getBlock(blockNumberToUse)
  const governor = getGovernor(governorType, governorAddress)

  const [proposalId, timelock] = await Promise.all([
    generateProposalId(governorType, governorAddress, { targets, values, calldatas, description }),
    getTimelock(governorType, governorAddress),
  ])

  const startBlock = BigNumber.from(latestBlock.number - 100) // arbitrarily subtract 100
  const proposal: ProposalEvent = {
    id: proposalId, // Bravo governor
    proposalId, // OZ governor (for simplicity we just include both ID formats)
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
  // Get voting token and total supply
  const votingToken = await getVotingToken(governorType, governorAddress, proposalId)
  const votingTokenSupply = <BigNumber>await votingToken.totalSupply() // used to manipulate vote count

  // Set `from` arbitrarily.
  const from = DEFAULT_FROM

  // Run simulation at the block right after the proposal ends.
  const simBlock = proposal.endBlock!.add(1)

  // Determine simulation timestamp based on governor type
  const simTimestamp =
    governorType === 'bravo'
      ? BigNumber.from(latestBlock.timestamp).add(simBlock.sub(proposal.endBlock!).mul(12))
      : BigNumber.from(latestBlock.timestamp + 1)

  const timestampBignumber = BigNumber.from(Math.floor(new Date().getTime() / 1000) + 2 * 24 * 60 * 60)
  const timestamp = timestampBignumber.toHexString()

  // Generate timelock state overrides
  const timelockParams: TimelockOverrideParams = {
    targets,
    values,
    signatures,
    calldatas,
    timestamp: timestampBignumber,
    description,
    governorType,
  }
  const timelockStorageObj = await generateTimelockOverrides(timelockParams)

  // Generate governor state overrides
  let governorStateOverrides: Record<string, string> = {}
  if (governorType === 'bravo') {
    const proposalKey = `proposals[${proposalId.toString()}]`
    governorStateOverrides = {
      proposalCount: proposalId.toString(),
      [`${proposalKey}.id`]: proposalId.toString(),
      [`${proposalKey}.proposer`]: DEFAULT_FROM,
      [`${proposalKey}.eta`]: timestampBignumber.toString(),
      [`${proposalKey}.startBlock`]: proposal.startBlock.toString(),
      [`${proposalKey}.endBlock`]: proposal.endBlock.toString(),
      [`${proposalKey}.canceled`]: 'false',
      [`${proposalKey}.executed`]: 'false',
      [`${proposalKey}.forVotes`]: votingTokenSupply.toString(),
      [`${proposalKey}.againstVotes`]: '0',
      [`${proposalKey}.abstainVotes`]: '0',
    }

    targets.forEach((target, i) => {
      const value = BigNumber.from(values[i]).toString()
      governorStateOverrides[`${proposalKey}.targets[${i}]`] = target
      governorStateOverrides[`${proposalKey}.values[${i}]`] = value
      governorStateOverrides[`${proposalKey}.signatures[${i}]`] = signatures[i]
      governorStateOverrides[`${proposalKey}.calldatas[${i}]`] = calldatas[i]
    })
  } else if (governorType === 'oz') {
    const overrideParams: GovernorOverrideParams = {
      proposalId,
      governor,
      eta: timestampBignumber,
    }
    governorStateOverrides = await getGovernorOverrides(overrideParams)
  } else {
    throw new Error(`Cannot generate overrides for unknown governor type: ${governorType}`)
  }

  const stateOverrides = {
    networkID: '1',
    stateOverrides: {
      [timelock.address]: {
        value: timelockStorageObj,
      },
    },
  }

  const storageObj = await sendEncodeRequest(stateOverrides)

  // --- Simulate it ---
  const descriptionHash = keccak256(toUtf8Bytes(description))
  const executeInputs =
    governorType === 'bravo' ? [proposalId.toString()] : [targets, values, calldatas, descriptionHash]

  const payloadParams: SimulationPayloadParams = {
    networkId: '1',
    blockNumber: latestBlock.number,
    from: DEFAULT_FROM,
    to: governor.address,
    input: governor.interface.encodeFunctionData('execute', executeInputs),
    gas: BLOCK_GAS_LIMIT,
    gasPrice: '0',
    value: '0',
    simBlock,
    simTimestamp,
    stateObjects: {
      [from]: { balance: '0' },
      [timelock.address]: { storage: storageObj.stateOverrides[timelock.address.toLowerCase()].value },
      [governor.address]: { storage: governorStateOverrides },
    },
  }

  const simulationPayload = createSimulationPayload(payloadParams)
  const sim = await sendSimulation(simulationPayload)
  writeFileSync('new-response.json', JSON.stringify(sim, null, 2))
  return { sim, proposal, latestBlock }
}

/**
 * @notice Simulates execution of an on-chain proposal that has not yet been executed
 * @param config Configuration object
 */
async function simulateProposed(config: SimulationConfigProposed): Promise<SimulationResult> {
  console.log('Simulating proposed proposal...')
  const { governorAddress, governorType, proposalId } = config

  // --- Get details about the proposal we're simulating ---
  const network = await provider.getNetwork()
  const blockNumberToUse = (await getLatestBlock(network.chainId)) - 3 // subtracting a few blocks to ensure tenderly has the block
  const latestBlock = await provider.getBlock(blockNumberToUse)
  const blockRange = [0, latestBlock.number]
  const governor = getGovernor(governorType, governorAddress)

  const [_proposal, proposalCreatedLogs, timelock] = await Promise.all([
    getProposal(governorType, governorAddress, proposalId),
    governor.queryFilter(governor.filters.ProposalCreated(), ...blockRange),
    getTimelock(governorType, governorAddress),
  ])
  const proposal = <ProposalStruct>_proposal

  const proposalCreatedEventWrapper = proposalCreatedLogs.filter((log) => {
    return getProposalId(log.args as unknown as ProposalEvent).eq(proposalId)
  })[0]
  if (!proposalCreatedEventWrapper)
    throw new Error(`Proposal creation log for #${proposalId} not found in governor logs`)
  const proposalCreatedEvent = proposalCreatedEventWrapper.args as unknown as ProposalEvent
  const { targets, signatures: sigs, calldatas, description } = proposalCreatedEvent

  // Workaround an issue that ethers cannot decode the values properly.
  // We know that the values are the 4th parameter in
  // `ProposalCreated(proposalId, proposer, targets, values, signatures, calldatas, startBlock, endBlock, description)`
  const values: BigNumber[] = proposalCreatedEventWrapper.args![3]

  // Get voting token and total supply
  const votingToken = await getVotingToken(governorType, governorAddress, proposal.id)
  const votingTokenSupply = <BigNumber>await votingToken.totalSupply() // used to manipulate vote count

  // Set `from` arbitrarily.
  const from = DEFAULT_FROM

  // Determine simulation block and timestamp
  const simBlock = governorType === 'bravo' ? proposal.endBlock!.add(1) : BigNumber.from(latestBlock.number + 1)
  const simTimestamp =
    governorType === 'bravo'
      ? BigNumber.from(latestBlock.timestamp).add(simBlock.sub(proposal.endBlock!).mul(12))
      : proposal.endTime!.add(1)
  const eta = simTimestamp // set proposal eta to be equal to the timestamp we simulate at

  const timestampBignumber = BigNumber.from(Math.floor(new Date().getTime() / 1000) + 2 * 24 * 60 * 60)
  const timestamp = timestampBignumber.toHexString()

  // Generate timelock state overrides
  const timelockParams: TimelockOverrideParams = {
    targets,
    values,
    signatures: sigs,
    calldatas,
    timestamp: timestampBignumber,
    description,
    governorType,
  }
  const timelockStorageObj = await generateTimelockOverrides(timelockParams)

  // Generate governor state overrides
  const proposalIdBn = BigNumber.from(proposalId)
  let governorStateOverrides: Record<string, string> = {}
  if (governorType === 'bravo') {
    const proposalKey = `proposals[${proposalIdBn.toString()}]`
    governorStateOverrides = {
      proposalCount: proposalId.toString(),
      [`${proposalKey}.eta`]: eta.toString(),
      [`${proposalKey}.canceled`]: 'false',
      [`${proposalKey}.executed`]: 'false',
      [`${proposalKey}.forVotes`]: votingTokenSupply.toString(),
      [`${proposalKey}.againstVotes`]: '0',
      [`${proposalKey}.abstainVotes`]: '0',
    }
  } else if (governorType === 'oz') {
    const overrideParams: GovernorOverrideParams = {
      proposalId,
      governor,
      eta: timestampBignumber,
    }
    governorStateOverrides = await getGovernorOverrides(overrideParams)
  } else {
    throw new Error(`Cannot generate overrides for unknown governor type: ${governorType}`)
  }

  const stateOverrides = {
    networkID: '1',
    stateOverrides: {
      [timelock.address]: {
        value: timelockStorageObj,
      },
    },
  }

  const storageObj = await sendEncodeRequest(stateOverrides)

  // Generate simulation payload
  const descriptionHash = keccak256(toUtf8Bytes(description))
  const executeInputs =
    governorType === 'bravo' ? [proposalId.toString()] : [targets, values, calldatas, descriptionHash]

  const stateObjects = {
    [from]: { balance: '0' },
    [timelock.address]: { storage: storageObj.stateOverrides[timelock.address.toLowerCase()].value },
    [governor.address]: { storage: governorStateOverrides },
  }

  const payloadParams: SimulationPayloadParams = {
    networkId: '1',
    blockNumber: latestBlock.number,
    from,
    to: governor.address,
    input: governor.interface.encodeFunctionData('execute', executeInputs),
    gas: BLOCK_GAS_LIMIT,
    gasPrice: '0',
    value: '0',
    simBlock,
    simTimestamp: timestamp,
    stateObjects,
  }

  let simulationPayload = createSimulationPayload(payloadParams)

  const formattedProposal: ProposalEvent = {
    ...proposalCreatedEvent,
    values, // This does not get included otherwise
    id: BigNumber.from(proposalId), // Make sure we always have an ID field
  }

  let sim = await sendSimulation(simulationPayload)
  const bridgedSimulations = await simulateBridgedTransactions(config.proposalId, proposalCreatedEvent)
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
async function simulateExecuted(config: SimulationConfigExecuted): Promise<SimulationResult> {
  const { governorAddress, governorType, proposalId } = config

  console.log(`Simulating executed proposal #${proposalId}...`)
  // --- Get details about the proposal we're analyzing ---
  const latestBlock = await provider.getBlock('latest')
  const blockRange = [0, latestBlock.number]
  const governor = getGovernor(governorType, governorAddress)

  const [createProposalLogs, proposalExecutedLogs] = await Promise.all([
    governor.queryFilter(governor.filters.ProposalCreated(), ...blockRange),
    governor.queryFilter(governor.filters.ProposalExecuted(), ...blockRange),
  ])

  const proposalCreatedEvent = createProposalLogs.filter((log) => {
    return getProposalId(log.args as unknown as ProposalEvent).eq(proposalId)
  })[0]
  if (!proposalCreatedEvent) throw new Error(`Proposal creation log for #${proposalId} not found in governor logs`)
  const proposal = proposalCreatedEvent.args as unknown as ProposalEvent

  const proposalExecutedEvent = proposalExecutedLogs.filter((log) => {
    return getProposalId(log.args as unknown as ProposalEvent).eq(proposalId)
  })[0]
  if (!proposalExecutedEvent) throw new Error(`Proposal execution log for #${proposalId} not found in governor logs`)

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
    save_if_fails: false,
    save: false,
    generate_access_list: true,
  }
  const sim = await sendSimulation(simulationPayload)

  const formattedProposal: ProposalEvent = {
    ...proposal,
    id: BigNumber.from(proposalId), // Make sure we always have an ID field
    values: proposalCreatedEvent.args?.[3],
  }

  const bridgedSimulations = await simulateBridgedTransactions(config.proposalId, proposal)
  console.log(`Bridge simulations: ${bridgedSimulations.length}`)
  return { sim: { ...sim, bridgedSimulations }, proposal: formattedProposal, latestBlock }
}

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
 * Simulates L2 bridged transactions
 * @param proposalId The proposal ID
 * @param proposalEvent The proposal event data
 */
async function simulateBridgedTransactions(
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

      console.log(transactionInfo)

      const networkId = l2ChainIdMap[destinationChain]

      const l2TransactionsInfo = await getDecodedBytesForChain(
        CometChains.mainnet,
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

      // Construct the payloads for the bridged chain simulation
      const createProposalPayload = createSimulationPayload({
        networkId: networkId as string,
        blockNumber: latestBlock.number,
        from: payloadSender,
        to: ChainAddresses.L2BridgeReceiver[destinationChain] as string,
        input: input,
        gas: gas,
        gasPrice: '0',
        value: '0',
        simBlock: BigNumber.from(latestBlock.number),
        simTimestamp: hexStripZeros(BigNumber.from(latestBlock.timestamp).toHexString()),
        stateObjects: stateOverrides!,
      })

      const executeProposalPayload = createSimulationPayload({
        networkId: networkId as string,
        blockNumber: latestBlock.number + 2,
        from: DEFAULT_FROM,
        to: ChainAddresses.L2BridgeReceiver[destinationChain] as string,
        input: baseBridgeReceiver.interface.encodeFunctionData('executeProposal', [beforeProposalCount + 1]),
        gas: gas,
        gasPrice: '0',
        value: '0',
        simBlock: BigNumber.from(latestBlock.number + 2),
        simTimestamp: hexStripZeros(BigNumber.from(latestBlock.timestamp + 4 * 24 * 60 * 60).toHexString()),
        stateObjects: {},
      })

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

/**
 * Creates a proposal event from bridge simulation results
 * @param bundledSimulation The simulation results
 * @param chain The destination chain
 * @param block The block data
 */
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
