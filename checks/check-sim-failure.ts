import {
  BridgedCheckResult,
  CheckResult,
  ProposalCheck,
} from '../types'
import { capitalizeWord } from './compound/formatters/helper'

/**
 * Reports all simulation failures from the proposal
 */
export const checkSimFailure: ProposalCheck = {
  name: 'Reports all simulation failures from the proposal',
  async checkProposal(proposal, sim, deps): Promise<CheckResult> {
    const bridgedSimulations = sim.bridgedSimulations || []
    
    const info: string[] = []
    const errors: string[] = []
    // Check if the transaction reverted, and if so return revert reason
    if (!sim.transaction.status) {
      const txInfo = sim.transaction.transaction_info
      const reason = txInfo.stack_trace
        ? txInfo.stack_trace[0].error_reason ?? txInfo.stack_trace[0].error
        : 'unknown error'
      errors.push(`Transaction reverted with reason: ${reason}`)
    } else {
      info.push(`${capitalizeWord(deps.chain)} simulation was successful`)
    }

    const bridgedCheckResults: BridgedCheckResult[] = []
    
    bridgedSimulations.forEach((b) => {
      const bridgeInfo: string[] = []
      const bridgeErrors: string[] = []
      if(b.success){
        bridgeInfo.push(`Simulation for ${capitalizeWord(b.chain)} was successful`)
      } else {
        if (b.sim) {
          b.sim.simulation_results.forEach((sr) => {
            if (!sr.transaction.status) {
              const txInfo = sr.transaction.transaction_info
              const reason = txInfo.stack_trace
                ? txInfo.stack_trace[0].error_reason ?? txInfo.stack_trace[0].error
                : 'unknown error'
              bridgeErrors.push(`Transaction reverted with reason: ${reason}`)
            }
          })
        } else {
          bridgeErrors.push(`Simulation for ${capitalizeWord(b.chain)} failed`)
        }
      }
      
      if (bridgeErrors.length > 0) {
        bridgedCheckResults.push({
          chain: b.chain,
          checkResults: { info: [], warnings: [], errors: bridgeErrors },
        });
      } else if (bridgeInfo.length > 0) {
        bridgedCheckResults.push({
          chain: b.chain,
          checkResults: { info: bridgeInfo, warnings: [], errors: [] },
        });
      }
    })

    return { info, warnings: [], errors, bridgedCheckResults }
  },
}
