import { customProvider } from '../../../utils/clients/ethers'
import { getContractNameAndAbiFromFile } from '../abi-utils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from './../compound-types'
import {
  defactor,
  getContractSymbolAndDecimalsFromFile,
  getFormattedTokenWithLink,
  getPlatform,
  getRecipientNameWithLink,
} from './helper'
import { Contract } from 'ethers'

export const bridgeFormatters: { [functionName: string]: TransactionFormatter } = {
  'depositFor(address,address,bytes)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    if (transaction.target === '0xa0c68c638235ee32657e8f720a23cec1bfc77c77') {
      const [recipient, token, amount] = decodedParams

      const formattedTokenWithLink = await getFormattedTokenWithLink(CometChains.mainnet, token, amount)
      const recipientWithLink = getRecipientNameWithLink(CometChains.polygon, recipient)
      return `\n\n Deposit ${formattedTokenWithLink} to ${recipientWithLink} on Polygon.`
    }

    throw new Error('Unknown bridge contract')
  },
  'outboundTransferCustomRefund(address,address,address,uint256,uint256,uint256,bytes)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    const platform = await getPlatform(chain)

    const tokenAddress = decodedParams[0]
    const { abi: tokenAbi } = await getContractNameAndAbiFromFile(chain, tokenAddress)
    const tokenInstance = new Contract(tokenAddress, tokenAbi, customProvider(chain))
    const { symbol: tokenSymbol, decimals: tokenDecimals } = await getContractSymbolAndDecimalsFromFile(
      tokenAddress,
      tokenInstance,
      chain
    )
    const amount = defactor(BigInt(decodedParams[3]), parseFloat(`1e${tokenDecimals}`))
    const recipientWithLink = getRecipientNameWithLink(CometChains.arbitrum, decodedParams[2])

    return `\n\nBridge ${amount.toFixed(
      2
    )} [${tokenSymbol}](https://${platform}/address/${tokenAddress}) tokens over Arbitrum to ${recipientWithLink}.`
  },
}
