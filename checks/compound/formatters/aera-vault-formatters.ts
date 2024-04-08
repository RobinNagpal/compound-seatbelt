import { getContractNameAndAbiFromFile } from '../abi-utils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from '../compound-types'
import { formatCoinsAndAmounts, getContractNameWithLink, getPlatform } from './helper'

export const aeraVaultFormatters: { [functionName: string]: TransactionFormatter } = {
  'acceptOwnership()': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const contractNameWithLink = await getContractNameWithLink(transaction.target, chain)
    return `Accept ownership of ${contractNameWithLink}.`
  },
  'deposit(tuple[])': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const tuple = decodedParams[0].split(',')
    const depositedAssets = await formatCoinsAndAmounts(tuple, chain)
    const contractNameWithLink = await getContractNameWithLink(transaction.target, chain)

    return `🛑 Deposit ${depositedAssets} into ${contractNameWithLink}.`
  },
  'resume()': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const contractNameWithLink = await getContractNameWithLink(transaction.target, chain)

    return `Resume the ${contractNameWithLink}, allowing the guardian to start re-balancing.`
  },
}
