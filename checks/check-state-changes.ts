import { getAddress } from '@ethersproject/address'
import { getContractName } from '../utils/clients/tenderly'
import { bullet } from '../presentation/report'
import {
  BridgedCheckResult,
  BridgedSimulation,
  ProposalCheck,
  ProposalData,
  StateDiff,
  TenderlyContract,
  TenderlySimulation,
} from '../types'

function createStateDiffsResult(simStateDiffs: StateDiff[], deps: ProposalData, tenderlyContracts: TenderlyContract[]) {
  const info = [] as string[]
  const warnings = [] as string[]
  const stateDiffs = simStateDiffs.reduce((diffs, diff) => {
    const addr = getAddress(diff.raw[0].address)
    // Check if this is a diff that should be filtered out
    const isGovernor = getAddress(addr) == deps.governor.address
    const isProposalsVar = diff.soltype?.name === 'proposals' || diff.soltype?.name === '_proposals'
    const isTimelock = getAddress(addr) == deps.timelock.address
    const isTimelockTimestamps = diff.soltype?.name === '_timestamps'
    const isQueuedTx = diff.soltype?.name.includes('queuedTransactions')
    const isExecutedSlot =
      diff.raw[0].original === '0x0000000000000000000000000000000000000000000000000000000000000000' &&
      diff.raw[0].dirty === '0x0000000000000000000000000000000000000000000000000000000000000100'

    const shouldSkipDiff =
      (isGovernor && isProposalsVar) ||
      (isGovernor && isExecutedSlot) ||
      (isTimelock && isQueuedTx) ||
      (isTimelock && isTimelockTimestamps)

    // Skip diffs as required and add the rest to our diffs object
    if (shouldSkipDiff) return diffs
    else if (!diffs[addr]) diffs[addr] = [diff]
    else diffs[addr].push(diff)
    return diffs
  }, {} as Record<string, StateDiff[]>)

  // Return if no state diffs to show
  if (!Object.keys(stateDiffs).length) return { info: ['No state changes'], warnings: [], errors: [] }

  // Parse state changes at each address
  // TODO support ETH state changes once tenderly adds support for that in the simulation response
  for (const [address, diffs] of Object.entries(stateDiffs)) {
    // Use contracts array to get contract name of address

    const contract = tenderlyContracts.find((c) => c.address === address)
    info.push(bullet(getContractName(contract)))

    // Parse each diff. A single diff may involve multiple storage changes, e.g. a proposal that
    // executes three transactions will show three state changes to the `queuedTransactions`
    // mapping within a single `diff` element. We always JSON.stringify the values so structs
    // (i.e. tuples) don't print as [object Object]
    diffs.forEach((diff) => {
      // Sometimes Tenderly will return state changes where the original value is null, which
      // means the original and dirty (new) values are the same. This is currently a bug, but it
      // only happens when the original and dirty values match (i.e. no storage was changed,
      // because the slot went from original -> other value -> original). As a result we can
      // safely skip these diffs.
      if (diff.original === null) return

      if (!diff.soltype) {
        // In this branch, state change is not decoded, so return raw data of each storage write
        // (all other branches have decoded state changes)
        diff.raw.forEach((w) => {
          const oldVal = JSON.stringify(w.original)
          const newVal = JSON.stringify(w.dirty)
          info.push(bullet(`Slot \`${w.key}\` changed from \`${oldVal}\` to \`${newVal}\``, 1))
        })
      } else if (diff.soltype.simple_type) {
        // This is a simple type with a single changed value
        const oldVal = JSON.parse(JSON.stringify(diff.original))
        const newVal = JSON.parse(JSON.stringify(diff.dirty))
        info.push(bullet(`\`${diff.soltype.name}\` changed from \`${oldVal}\` to \`${newVal}\``, 1))
      } else if (diff.soltype.type.startsWith('mapping')) {
        // This is a complex type like a mapping, which may have multiple changes. The diff.original
        // and diff.dirty fields can be strings or objects, and for complex types they are objects,
        // so we cast them as such
        const keys = Object.keys(diff.original)
        const original = diff.original as Record<string, any>
        const dirty = diff.dirty as Record<string, any>
        keys.forEach((k) => {
          const oldVal = JSON.stringify(original[k])
          const newVal = JSON.stringify(dirty[k])
          info.push(bullet(`\`${diff.soltype?.name}\` key \`${k}\` changed from \`${oldVal}\` to \`${newVal}\``, 1))
        })
      } else {
        // TODO arrays and nested mapping are currently not well supported -- find a transaction
        // that changes state of these types to inspect the Tenderly simulation response and
        // handle it accordingly. In the meantime we show the raw state changes and print a
        // warning about decoding the data
        diff.raw.forEach((w) => {
          const oldVal = JSON.stringify(w.original)
          const newVal = JSON.stringify(w.dirty)
          info.push(bullet(`Slot \`${w.key}\` changed from \`${oldVal}\` to \`${newVal}\``, 1))
          warnings.push(`Could not parse state: add support for formatting type ${diff.soltype?.type} (slot ${w.key})`)
        })
      }
    })
  }

  return { info, warnings: [], errors: [] }
}

/**
 * Reports all state changes from the proposal
 */
export const checkStateChanges: ProposalCheck = {
  name: 'Reports all state changes from the proposal',
  async checkProposal(proposal, sim, deps) {
    const bridgedSimulations = sim.bridgedSimulations
    console.log(`check-state-changes - Bridge simulations: ${bridgedSimulations?.length}`)
    // Check if the transaction reverted, and if so return revert reason
    if (!sim.transaction.status) {
      const txInfo = sim.transaction.transaction_info
      const reason = txInfo.stack_trace
        ? txInfo.stack_trace[0].error_reason ?? txInfo.stack_trace[0].error
        : 'unknown error'
      const error = `Transaction reverted with reason: ${reason}`
      return { info: [], warnings: [], errors: [error] }
    }

    const bridgeSims = bridgedSimulations
    if (bridgeSims) {
      console.log('Bridge sims found')
      for (const bridgeSim of bridgeSims) {
        console.log('Bridge sim', bridgeSim)
      }
    }

    // State diffs in the simulation are an array, so first we organize them by address. We skip
    // recording state changes for (1) the `queuedTransactions` mapping of the timelock, and
    // (2) the `proposal.executed` change of the governor, because this will be consistent across
    // all proposals and mainly add noise to the output
    const simStateDiffs = sim.transaction.transaction_info.state_diff
    if (!simStateDiffs) {
      console.log('State diff is empty, printing sim response')
      console.log(JSON.stringify(sim, null, 2))
    }
    const tenderlyContracts = sim.contracts
    const mainnetChecks = createStateDiffsResult(simStateDiffs, deps, tenderlyContracts)

    const bridgedCheckResults = bridgedSimulations?.map((bridgedSim): BridgedCheckResult => {
      const checkResults = {
        info: [] as string[],
        warnings: [] as string[],
        errors: [] as string[],
      }
      bridgedSim.sim.simulation_results.forEach((sim) => {
        const bridgeStateDiffs = sim.transaction.transaction_info.state_diff
        const bridgedContracts = sim.contracts

        const results = createStateDiffsResult(bridgeStateDiffs, deps, bridgedContracts)
        checkResults.info.push(...results.info)
        checkResults.warnings.push(...results.warnings)
        checkResults.errors.push(...results.errors)
      })

      return {
        chain: bridgedSim.chain,
        checkResults: {
          info: checkResults.info,
          warnings: checkResults.warnings,
          errors: checkResults.errors,
        },
      }
    })

    console.log('Mainnet checks', mainnetChecks)
    console.log('Bridged checks', JSON.stringify(bridgedCheckResults, null, 2))

    return { ...mainnetChecks, bridgedCheckResults }
  },
}
