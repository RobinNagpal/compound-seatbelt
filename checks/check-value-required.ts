import { Zero } from '@ethersproject/constants'
import { BigNumber } from '@ethersproject/bignumber'
import { formatEther } from '@ethersproject/units'
import { BridgedCheckResult, ProposalCheck, ProposalEvent } from '../types'

/**
 * Reports on whether the caller initiating the `execute` call needs to send ETH with the call.
 */
export const checkValueRequired: ProposalCheck = {
  name: 'Reports on whether the caller needs to send ETH with the call',
  async checkProposal(proposal, sim, deps) {
    const govBalance = formatEther(await deps.provider.getBalance(deps.governor.address))
    const mainnetResult = await createValueRequiredResult(proposal, BigNumber.from(sim.simulation.value), govBalance)
    
    const bridgedSimulations = sim.bridgedSimulations || []
    const bridgedCheckResults: BridgedCheckResult[] = []
    for (const b of bridgedSimulations) {
      if (b.sim && b.proposal) {
        const bridgeResults = await createValueRequiredResult(
          b.proposal, 
          BigNumber.from(b.sim.simulation_results[1].simulation.value), // using `1` because second simulation is the one associated with `execute` call
          null
        )
        bridgedCheckResults.push({ chain: b.chain, checkResults: { ...bridgeResults } });
      } else {
        bridgedCheckResults.push({ chain: b.chain, checkResults: { info: [], warnings: [], errors: ['No bridge proposal/simulation to check value required'] } });
      }
    }
        
    return {...mainnetResult, bridgedCheckResults}
  },
}

async function createValueRequiredResult(
  proposal: ProposalEvent,
  txValue: BigNumber,
  govBalance: string | null
){
  // TODO Fix typings for values. The `values` field is not always present in the proposal object,
  // but key `3` contains them. (Similarly key 0 is proposal ID, 1 is proposer, etc.). This is
  // related to why we use `proposalCreatedEvent.args![3]` in `tenderly.ts`.
  type ProposalValues = { '3': BigNumber[] }
  const totalValue = proposal.values
    ? // For local simulations, `values` exists and `3` does not.
      proposal.values.reduce((sum, cur) => sum.add(cur), Zero)
    : // For simulations read from the chain, `3` exists and `values` does not.
      (proposal as unknown as ProposalValues)['3'].reduce((sum, cur) => sum.add(cur), Zero)
      
  if (txValue.eq(Zero)) {
    const msg = 'No ETH is required to be sent by the account that executes this proposal.'
    return { info: [msg], warnings: [], errors: [] }
  }
  
  const valueRequired = formatEther(totalValue)
  const valueSent = formatEther(txValue)
  
  const msg1 = 'The account that executes this proposal will need to send ETH along with the transaction.'
  const msg2 = `The calls made by this proposal require a total of ${valueRequired} ETH, ${govBalance ? `and the Governor contract has ${govBalance} ETH.` : ''}`
  const msg3 = `As a result, the account that executes this proposal will need to send ${valueSent} ETH along with the transaction.`
  const msg = `${msg1}\n\n${msg2} ${msg3}`
  
  return { info: [], warnings: [msg], errors: [] }
}