import { Contract } from 'ethers'

import { customProvider } from '../../../utils/clients/ethers'
import { getContractNameAndAbiFromFile } from '../abi-utils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from '../compound-types'
import { defactorFn } from './../../../utils/roundingUtils'
import { addCommas, getContractSymbolAndDecimalsFromFile, getFormattedTokenNameWithLink, getPlatform, getRecipientNameWithLink } from './helper'

export const ERC20Formatters: { [functionName: string]: TransactionFormatter } = {
  'transfer(address,uint256)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = getPlatform(chain)

    const coinAddress = transaction.target
    const { abi } = await getContractNameAndAbiFromFile(chain, coinAddress)
    const tokenInstance = new Contract(coinAddress, abi, customProvider(chain))
    const { symbol, decimals } = await getContractSymbolAndDecimalsFromFile(coinAddress, tokenInstance, chain)

    const amount = defactorFn(decodedParams[1], `${decimals}`)

    return `🛑 Transfer **${addCommas(amount)} [${symbol}](https://${platform}/address/${coinAddress})** to ${getRecipientNameWithLink(
      chain,
      decodedParams[0]
    )}.`
  },
  'approve(address,uint256)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = getPlatform(chain)

    const tokenAddress = transaction.target
    const { abi } = await getContractNameAndAbiFromFile(chain, tokenAddress)
    const tokenInstance = new Contract(tokenAddress, abi, customProvider(chain))
    const { symbol, decimals } = await getContractSymbolAndDecimalsFromFile(tokenAddress, tokenInstance, chain)

    const amount = defactorFn(decodedParams[1], `${decimals}`)

    return `🛑 Approve **${addCommas(amount)} [${symbol}](https://${platform}/address/${tokenAddress})** tokens to ${getRecipientNameWithLink(
      chain,
      decodedParams[0]
    )}`
  },
}
