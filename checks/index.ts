import {
  checkTargetsVerifiedEtherscan,
  checkTouchedContractsVerifiedEtherscan,
} from './check-targets-verified-etherscan'
import { checkTargetsNoSelfdestruct, checkTouchedContractsNoSelfdestruct } from './check-targets-no-selfdestruct'
import { checkDecodeCalldata } from './check-decode-calldata'
import { checkLogs } from './check-logs'
import { checkSlither } from './check-slither'
import { checkSolc } from './check-solc'
import { checkStateChanges } from './check-state-changes'
import { checkValueRequired } from './check-value-required'
import { ProposalCheck } from '../types'
import { checkSimFailure } from './check-sim-failure'
import { checkTargetsNames } from './check-targets-names'

const ALL_CHECKS: {
  [checkId: string]: ProposalCheck
} = {
  checkSimFailure,
  checkTargetsNames,
  checkStateChanges,
  checkDecodeCalldata,
  checkLogs,
  checkTargetsVerifiedEtherscan,
  checkTouchedContractsVerifiedEtherscan,
  checkTargetsNoSelfdestruct,
  checkTouchedContractsNoSelfdestruct,
  checkValueRequired,
  // The solc check must be run before the slither check, because the compilation exports a zip file
  // which is consumed by slither. This prevents us from having to compile the contracts twice.
  checkSolc,
  checkSlither,
}

export default ALL_CHECKS
