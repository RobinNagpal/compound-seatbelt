import { defactorFn } from './../../../utils/roundingUtils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from '../compound-types'
import { addressFormatter } from './helper'

export const weth9Formatters: { [functionName: string]: TransactionFormatter } = {
  'deposit()': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    if (transaction.value && transaction.value.toString() !== '0') {
      const details = `Wrap **${defactorFn(transaction.value.toString())} ETH** to ${addressFormatter(transaction.target, chain, 'WETH')}.`
      return { summary: details, details }
    }
    throw new Error('No value provided for deposit transaction')
  },
}
