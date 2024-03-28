import { Contract } from 'ethers'

import { customProvider } from '../../../utils/clients/ethers'
import { getContractNameAndAbiFromFile } from '../abi-utils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from '../compound-types'
import { defactorFn } from './../../../utils/roundingUtils'
import { addCommas, addressFormatter, getContractSymbolAndDecimalsFromFile, getPlatform, getRecipientNameWithLink } from './helper'

export const ERC20Formatters: { [functionName: string]: TransactionFormatter } = {
  'transfer(address,uint256)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const coinAddress = transaction.target
    const { abi } = await getContractNameAndAbiFromFile(chain, coinAddress)
    const tokenInstance = new Contract(coinAddress, abi, customProvider(chain))
    const { symbol, decimals } = await getContractSymbolAndDecimalsFromFile(coinAddress, tokenInstance, chain)

    const amount = defactorFn(decodedParams[1], `${decimals}`)

    return `🛑 Transfer **${addCommas(amount)} ${addressFormatter(coinAddress, chain, symbol)}** to ${await getRecipientNameWithLink(chain, decodedParams[0])}.`
  },
  'approve(address,uint256)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const tokenAddress = transaction.target
    const { abi } = await getContractNameAndAbiFromFile(chain, tokenAddress)
    const tokenInstance = new Contract(tokenAddress, abi, customProvider(chain))
    const { symbol, decimals } = await getContractSymbolAndDecimalsFromFile(tokenAddress, tokenInstance, chain)

    const amount = defactorFn(decodedParams[1], `${decimals}`)

    return `🛑 Approve **${addCommas(amount)} ${addressFormatter(tokenAddress, chain, symbol)}** to ${await getRecipientNameWithLink(chain, decodedParams[0])}`
  },
}
