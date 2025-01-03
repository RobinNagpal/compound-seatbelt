import { getAddress } from '@ethersproject/address'
import { getContractName } from '../utils/clients/tenderly'
import { bullet } from '../presentation/report'
import { ProposalCheck, Log, ProposalData, BridgedCheckResult, TenderlyContract } from '../types'
import { ChainAddresses } from './compound/l2-utils'

/**
 * Reports all emitted events from the proposal
 */
export const checkLogs: ProposalCheck = {
  name: 'Reports all events emitted from the proposal',
  async checkProposal(proposal, sim, deps) {
    const bridgedSimulations = sim.bridgedSimulations || []
    
    const simLogs = sim.transaction.transaction_info.logs
    if (!simLogs) {
      console.log('Logs is empty, printing sim response')
      console.log(JSON.stringify(sim, null, 2))
    }
    const tenderlyContracts = sim.contracts
    const mainnetLogs = createLogResult(simLogs ?? [], deps, tenderlyContracts)
    
    const bridgedCheckResults: BridgedCheckResult[] = []
        bridgedSimulations.forEach((b) => {
          const bridgedLogs: Log[]  = b.sim?.simulation_results
            .map((sr) => {
              return sr.transaction?.transaction_info.logs?.filter((log) => {
                if (
                  log.raw.address?.toLowerCase() === ChainAddresses.L2Timelock[b.chain].toLowerCase() ||
                  log.raw.address?.toLowerCase() === ChainAddresses.L2BridgeReceiver[b.chain].toLowerCase()
                ) {
                  return false
                }
                return true
              }) || []
            })
            .flat() || []
            
          const bridgedContracts : TenderlyContract[] = b.sim?.simulation_results.map((sr) => sr.contracts).flat() || []
          const bridgedLogResult = createLogResult(bridgedLogs, deps, bridgedContracts)
          bridgedCheckResults.push({ chain: b.chain, checkResults: bridgedLogResult })
        })
    
    return {...mainnetLogs, bridgedCheckResults}
  },
}

function createLogResult(
    simLogs: Log[] | [],
    deps: ProposalData,
    tenderlyContracts: TenderlyContract[]
){
  const info: string[] = []

  // Emitted logs in the simulation are an array, so first we organize them by address. We skip
  // recording logs for (1) the `queuedTransactions` mapping of the timelock, and
  // (2) the `proposal.executed` change of the governor, because this will be consistent across
  // all proposals and mainly add noise to the output
  // TODO remove some logic currently duplicated in the checkStateChanges check?
  const events = simLogs.reduce((logs, log) => {
    const addr = getAddress(log.raw.address)
    // Check if this is a log that should be filtered out
    const isGovernor = getAddress(addr) == deps.governor.address
    const isTimelock = getAddress(addr) == deps.timelock.address
    const shouldSkipLog =
      (isGovernor && log.name === 'ProposalExecuted') || (isTimelock && log.name === 'ExecuteTransaction')
    // Skip logs as required and add the rest to our logs object
    if (shouldSkipLog) return logs
    else if (!logs[addr]) logs[addr] = [log]
    else logs[addr].push(log)
    return logs
  }, {} as Record<string, Log[]>)
  // Return if no events to show
  if (!events || !Object.keys(events).length) return { info: ['No events emitted'], warnings: [], errors: [] }
  // Parse each event
  for (const [address, logs] of Object.entries(events)) {
    // Use contracts array to get contract name of address
    const contract = tenderlyContracts.find((c) => c.address === address)
    info.push(bullet(getContractName(contract)))
    // Format log data for report
    logs.forEach((log) => {
      if (Boolean(log.name)) {
        // Log is decoded, format data as: VotingDelaySet(oldVotingDelay: value, newVotingDelay: value)
        const parsedInputs = log.inputs?.map((i) => `${i.soltype!.name}: ${i.value}`).join(', ')
        info.push(bullet(`\`${log.name}(${parsedInputs})\``, 1))
      } else {
        // Log is not decoded, report the raw data
        // TODO find a transaction with undecoded logs to know how topics/data are formatted in simulation response
        info.push(bullet(`Undecoded log: \`${JSON.stringify(log)}\``, 1))
      }
    })
  }
  return { info, warnings: [], errors: [] }
}