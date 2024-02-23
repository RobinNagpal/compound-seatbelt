import { customProvider } from '../../../utils/clients/ethers'
import { getContractNameAndAbiFromFile } from '../abi-utils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from './../compound-types'
import { addCommas, formatTimestamp, getContractSymbolAndDecimalsFromFile, getFormattedTokenWithLink, getPlatform, getRecipientNameWithLink } from './helper'
import { Contract } from 'ethers'
import { defactorFn } from './../../../utils/roundingUtils'

export const bridgeFormatters: { [functionName: string]: TransactionFormatter } = {
  'depositFor(address,address,bytes)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    if (transaction.target === '0xa0c68c638235ee32657e8f720a23cec1bfc77c77') {
      const [recipient, token, amount] = decodedParams

      const formattedTokenWithLink = await getFormattedTokenWithLink(CometChains.mainnet, token, amount)
      const recipientWithLink = getRecipientNameWithLink(CometChains.polygon, recipient)
      return `Deposit ${formattedTokenWithLink} to ${recipientWithLink} on Polygon.`
    }

    throw new Error('Unknown bridge contract')
  },
  'outboundTransferCustomRefund(address,address,address,uint256,uint256,uint256,bytes)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    const platform = getPlatform(chain)

    const tokenAddress = decodedParams[0]
    const { abi: tokenAbi } = await getContractNameAndAbiFromFile(chain, tokenAddress)
    const tokenInstance = new Contract(tokenAddress, tokenAbi, customProvider(chain))
    const { symbol: tokenSymbol, decimals: tokenDecimals } = await getContractSymbolAndDecimalsFromFile(tokenAddress, tokenInstance, chain)
    const amount = defactorFn(decodedParams[3], `${tokenDecimals}`)
    const recipientWithLink = getRecipientNameWithLink(CometChains.arbitrum, decodedParams[2])

    return `Bridge ${addCommas(amount)} [${tokenSymbol}](https://${platform}/address/${tokenAddress}) tokens over Arbitrum to ${recipientWithLink}.`
  },
  'createStream(address,uint256,address,uint256,uint256)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = getPlatform(chain)
    const senderAddress = transaction.target
    const recipientAddress = decodedParams[0]
    const { contractName: senderName } = await getContractNameAndAbiFromFile(chain, transaction.target)

    const tokenAddress = decodedParams[2]
    const { abi: tokenAbi } = await getContractNameAndAbiFromFile(chain, tokenAddress)
    const tokenInstance = new Contract(tokenAddress, tokenAbi, customProvider(chain))
    const { symbol: tokenSymbol, decimals: tokenDecimals } = await getContractSymbolAndDecimalsFromFile(tokenAddress, tokenInstance, chain)

    const amount = defactorFn(decodedParams[1], `${tokenDecimals}`)

    const recipientWithLink = getRecipientNameWithLink(chain, recipientAddress)

    return `Create a stream on [${senderName}](https://${platform}/address/${senderAddress}) to transfer **${addCommas(
      amount
    )}** [${tokenSymbol}](https://${platform}/address/${tokenAddress}) to ${recipientWithLink}. The stream will start at ${formatTimestamp(
      decodedParams[3]
    )} and end at ${formatTimestamp(decodedParams[4])}.`
  },
}
