import { TransactionFormatter } from './compound-types'
import { compFormatters } from './formatters/comp-formatters'
import { comptrollerFormatters } from './formatters/comptroller-formatters'
import { configuratorFormatters } from './formatters/configurator-formatters'
import { ERC20Formatters } from './formatters/erc20-formatters'

export const formattersLookup: {
  [contractName: string]: {
    [functionName: string]: TransactionFormatter
  }
} = {
  Configurator: configuratorFormatters,
  Comp: compFormatters,
  Comptroller: comptrollerFormatters,
  ERC20: ERC20Formatters,
}
