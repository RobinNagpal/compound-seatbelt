import { customProvider } from '../../../utils/clients/ethers'
import { getContractNameAndAbiFromFile } from '../abi-utils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from './../compound-types'
import { addCommas, formatTimestamp, getContractSymbolAndDecimalsFromFile, getPlatform, getRecipientNameWithLink } from './helper'
import { Contract } from 'ethers'
import { defactorFn } from './../../../utils/roundingUtils'

export const bridgeFormatters: { [functionName: string]: TransactionFormatter } = {
  'depositFor(address,address,bytes)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    if (transaction.target === '0xa0c68c638235ee32657e8f720a23cec1bfc77c77') {
      const [recipient, token, amount] = decodedParams

      const platform = getPlatform(chain)
      const { abi: compAddressAbi } = await getContractNameAndAbiFromFile(chain, token)
      const compInstance = new Contract(token, compAddressAbi, customProvider(chain))
      const { symbol, decimals } = await getContractSymbolAndDecimalsFromFile(token, compInstance, chain)
      const defactoredAmount = defactorFn(amount, `${decimals}`)
      const recipientWithLink = getRecipientNameWithLink(CometChains.polygon, recipient)
      return `🛑 Bridge **${addCommas(defactoredAmount)} [${symbol}](https://${platform}/address/${token})** tokens over Polygon to ${recipientWithLink}.`
    }

    throw new Error('Unknown bridge contract')
  },
  'outboundTransferCustomRefund(address,address,address,uint256,uint256,uint256,bytes)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    if (transaction.target === '0x72ce9c846789fdb6fc1f34ac4ad25dd9ef7031ef') {
      const platform = getPlatform(chain)

      const tokenAddress = decodedParams[0]
      const { abi: tokenAbi } = await getContractNameAndAbiFromFile(chain, tokenAddress)
      const tokenInstance = new Contract(tokenAddress, tokenAbi, customProvider(chain))
      const { symbol: tokenSymbol, decimals: tokenDecimals } = await getContractSymbolAndDecimalsFromFile(tokenAddress, tokenInstance, chain)
      const amount = defactorFn(decodedParams[3], `${tokenDecimals}`)
      const recipientWithLink = getRecipientNameWithLink(CometChains.arbitrum, decodedParams[2])

      return `🛑 Bridge **${addCommas(amount)} [${tokenSymbol}](https://${platform}/address/${tokenAddress})** tokens over Arbitrum to ${recipientWithLink}.`
    }
    throw new Error('Unknown bridge contract')
  },
}
