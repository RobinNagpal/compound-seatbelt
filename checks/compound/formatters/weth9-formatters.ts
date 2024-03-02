import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from '../compound-types'
import { getPlatform } from './helper'

export const weth9Formatters: { [functionName: string]: TransactionFormatter } = {
  'deposit()': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = getPlatform(chain)
    const targetAddress = transaction.target
    console.log('Transaction : ', transaction)
    console.log('Decoded params : ', decodedParams)
    return `Wrap this much ETH to WETH`
  },
}
