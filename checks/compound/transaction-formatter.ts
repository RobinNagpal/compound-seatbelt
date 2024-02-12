import { TransactionFormatter } from './compound-types'
import { compFormatters } from './formatters/comp-formatters'
import { comptrollerFormatters } from './formatters/comptroller-formatters'
import { configuratorFormatters } from './formatters/configurator-formatters'
import { ERC20Formatters } from './formatters/erc20-formatters'
import { bridgeFormatters } from './formatters/bridge-formatters'
import { governorBravoFormatters } from './formatters/governor-bravo-formatters'
import { L1Formatters } from './formatters/L1-formatters'

export const formattersLookup: {
  [contractName: string]: {
    [functionName: string]: TransactionFormatter
  }
} = {
  Configurator: configuratorFormatters,
  Comp: compFormatters,
  Comptroller: comptrollerFormatters,
  ERC20: ERC20Formatters,
  BridgeFormatters: bridgeFormatters,
  GovernorBravo: governorBravoFormatters,
  L1Formatters: L1Formatters,
}
