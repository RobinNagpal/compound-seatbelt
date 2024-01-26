import { TransactionFormatter } from './compound-types'
import { compFormatters } from './formatters/comp-formatters'
import { configuratorFormatters } from './formatters/configurator-formatters'

export const formattersLookup: {
  [contractName: string]: {
    [functionName: string]: TransactionFormatter
  }
} = {
  Configurator: configuratorFormatters,
  Comp: compFormatters,
}
