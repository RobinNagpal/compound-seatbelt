import util from 'util'
import { exec as execCallback } from 'child_process'
import { getAddress } from '@ethersproject/address'
import { getContractName } from '../utils/clients/tenderly'
import { codeBlock } from '../presentation/report'
import { getImplementation } from '../utils/contracts/governor'
import { BridgedCheckResult, ProposalCheck, TenderlyContract } from '../types'
import { ChainAddresses, apiKeyFlagConfig, apiKeyFlagMap } from './compound/l2-utils'
import { capitalizeWord } from './compound/formatters/helper'
import { CometChains } from './compound/compound-types'

// Convert exec method from a callback to a promise.
const exec = util.promisify(execCallback)

// Data returned from command execution.
type ExecOutput = {
  stdout: string
  stderr: string
}

/**
 * Runs crytic-compile against verified contracts to obtain solc compiler warnings. Assumes crytic-compile
 * is already installed.
 */
export const checkSolc: ProposalCheck = {
  name: 'Runs solc against the verified contracts',
  async checkProposal(proposal, sim, deps) {
    const warnings: string[] = []

    // Skip existing timelock and governor contracts to reduce noise. These contracts are already
    // deployed and in use, and if they are being updated, the new contract will be one of the
    // touched contracts that gets analyzed.
    // NOTE: This requires an archive node since we need to query for the governor implementation
    // at the simulation block number, since the implementation may have changed since.
    const addressesToSkip = new Set([deps.timelock.address, deps.governor.address])
    // TODO - need to handle this try-catch for market update flow cause proposer doesnt have an implementation
    try {
      const implementation = await getImplementation(deps.governor.address, sim.transaction.block_number, deps.provider)
      if (implementation) addressesToSkip.add(implementation)
    } catch (e) {
      const msg = `Could not read address of governor implementation at block \`${sim.transaction.block_number}\`. Make sure the \`RPC_URL\` is an archive node. As a result the Slither check will show warnings on the governor's implementation contract.`
      console.warn(`WARNING: ${msg}. Details:`)
      console.warn(e)
      warnings.push(msg)
    }

    const mainnetResults = await createSolcResult(addressesToSkip, sim.contracts, deps.chain)
        
    const bridgedSimulations = sim.bridgedSimulations || []
    const bridgedCheckResults: BridgedCheckResult[] = []
    for (const b of bridgedSimulations) {
      // TODO: Remove this check after crytic-compile add support for Scroll and Mantle
      if(b.chain === CometChains.scroll || b.chain === CometChains.mantle) {
        bridgedCheckResults.push({ chain: b.chain, checkResults: { info: [], warnings: [`Crytic compile does not support ${capitalizeWord(b.chain)}`], errors: [] } });
        continue
      }
      if (b.sim) {
        const addressesToSkip = new Set([ChainAddresses.L2BridgeReceiver[b.chain], ChainAddresses.L2Timelock[b.chain]])
        const bridgedContracts : TenderlyContract[] = b.sim.simulation_results.flatMap((sr) => sr.contracts) || []
        const bridgeResults = await createSolcResult(addressesToSkip, bridgedContracts, b.chain, deps.chain)
        bridgedCheckResults.push({ chain: b.chain, checkResults: { ...bridgeResults } });
      } else {
        bridgedCheckResults.push({ chain: b.chain, checkResults: { info: [], warnings: [], errors: ['No bridge simulation to run solc'] } });
      }
    }
    
    return { ...mainnetResults, warnings: [...mainnetResults.warnings, ...warnings], bridgedCheckResults }
  },
}

async function createSolcResult(
  addressesToSkip: Set<string>,
  simContracts: TenderlyContract[],
  chain: CometChains,
  sourceChain?: CometChains
) {
  const info: string[] = []
  const warnings: string[] = []
  // Return early if the only contracts touched are the timelock and governor.
  const contracts = simContracts.filter((contract) => !addressesToSkip.has(getAddress(contract.address)))
  if (contracts.length === 0) {
    return { info: [`No contracts to analyze: only the timelock and ${chain != (sourceChain ?? chain) ? 'bridge receiver':'governor'} are touched`], warnings, errors: [] }
  }
  
  const apiKeyFlag = apiKeyFlagMap[chain]

  // For each unique  verified contract we run solc against it via crytic-compile. It has a mode to run it directly against
  // a mainnet contract, which saves us from having to write files to a local temporary directory.
  for (const contract of Array.from(new Set(contracts))) {
    const addr = getAddress(contract.address)
    if (addressesToSkip.has(addr)) continue

    // Compile the contracts.
    const output = await runCryticCompile(contract.address, apiKeyFlag)
    if (!output) {
      warnings.push(`crytic-compile failed for \`${contract.contract_name}\` at \`${addr}\``)
      continue
    }

    // Append results to report info.
    const contractName = getContractName(contract)
    if (output.stderr === '') {
      info.push(`No compiler warnings for ${contractName}`)
    } else {
      info.push(`Compiler warnings for ${contractName}`)
      info.push(codeBlock(output.stderr.trim()))
    }
  }

  return { info, warnings, errors: [] }
}

/**
 * Tries to run crytic-compile via python installation in the specified directory.
 * @dev Exports a zip file which is used by the slither check.
 * @dev If you have nix/dapptools installed, you'll need to make sure the path to your python
 * executables (find this with `which solc-select`) comes before the path to your nix executables.
 * This may require editing your $PATH variable prior to running this check. If you don't do this,
 * the nix version of solc will take precedence over the solc-select version, and compilation will fail.
 */
async function runCryticCompile(address: string, {flag, key, prefix}: apiKeyFlagConfig): Promise<ExecOutput | null> {
  try {
    return await exec(`crytic-compile ${prefix}:${address} ${flag} ${key}`)
  } catch (e: any) {
    if ('stderr' in e) return e // Output is in stderr, but slither reports results as an exception.
    console.warn(`Error: Could not run crytic-compile via Python: ${JSON.stringify(e)}`)
    return null
  }
}
