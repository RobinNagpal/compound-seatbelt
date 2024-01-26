import { TransactionFormatter } from './compound-types'
import { configuratorFormatters } from './formatters/configurator-formatters'

export const formattersLookup: {
  [contractName: string]: {
    [functionName: string]: TransactionFormatter
  }
} = {
  Configurator: configuratorFormatters,
}
