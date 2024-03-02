import { getContractNameAndAbiFromFile } from '../abi-utils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from '../compound-types'
import { formatCoinsAndAmounts, getPlatform } from './helper'

export const aeraVaultFormatters: { [functionName: string]: TransactionFormatter } = {
  'acceptOwnership()': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = getPlatform(chain)
    const contractAddress = transaction.target

    const { contractName } = await getContractNameAndAbiFromFile(chain, contractAddress)

    return `Accept ownership of **[${contractName}](https://${platform}/address/${contractAddress})**.`
  },
  'deposit(tuple[])': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = getPlatform(chain)
    const contractAddress = transaction.target
    const tuple = decodedParams[0].split(',')
    const depositedAssets = await formatCoinsAndAmounts(tuple, chain, platform)
    const { contractName } = await getContractNameAndAbiFromFile(chain, contractAddress)

    return `🛑 Deposit **${depositedAssets}** into **[${contractName}](https://${platform}/address/${contractAddress})**.`
  },
  'resume()': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = getPlatform(chain)
    const contractAddress = transaction.target

    const { contractName } = await getContractNameAndAbiFromFile(chain, contractAddress)

    return `Resume the **[${contractName}](https://${platform}/address/${contractAddress})**, allowing the guardian to start rebalancing.`
  },
}
