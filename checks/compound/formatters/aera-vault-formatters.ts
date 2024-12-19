import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from '../compound-types'
import { formatCoinsAndAmounts, getContractNameWithLink, getIcon, getPlatform, IconType } from './helper'

export const aeraVaultFormatters: { [functionName: string]: TransactionFormatter } = {
  'acceptOwnership()': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const contractNameWithLink = await getContractNameWithLink(transaction.target, chain)
    const details = `${getIcon(IconType.Add)} Accept ownership of ${contractNameWithLink}.`
    return { summary: details, details }
  },
  'deposit(tuple[])': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const tuple = decodedParams[0].split(',')
    const depositedAssets = await formatCoinsAndAmounts(tuple, chain)
    const contractNameWithLink = await getContractNameWithLink(transaction.target, chain)

    const details = `${getIcon(IconType.Money)} Deposit ${depositedAssets} into ${contractNameWithLink}.`
    return { summary: details, details }
  },
  'resume()': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const contractNameWithLink = await getContractNameWithLink(transaction.target, chain)

    const details = `${getIcon(IconType.Unpause)} Resume the ${contractNameWithLink}, allowing the guardian to start re-balancing.`
    return { summary: details, details }
  },
}
