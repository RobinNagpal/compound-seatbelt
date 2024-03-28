import { getContractNameAndAbiFromFile } from '../abi-utils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from '../compound-types'
import {
  addCommas,
  addressFormatter,
  formatTimestamp,
  getContractNameWithLink,
  getContractSymbolAndDecimalsFromFile,
  getPlatform,
  getRecipientNameWithLink,
} from './helper'
import { customProvider } from './../../../utils/clients/ethers'
import { defactorFn } from './../../../utils/roundingUtils'
import { Contract } from 'ethers'

export const sablierFormatters: { [functionName: string]: TransactionFormatter } = {
  'createStream(address,uint256,address,uint256,uint256)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const recipientAddress = decodedParams[0]
    const senderContractNameWithLink = await getContractNameWithLink(transaction.target, chain)
    const tokenAddress = decodedParams[2]
    const { abi: tokenAbi } = await getContractNameAndAbiFromFile(chain, tokenAddress)
    const tokenInstance = new Contract(tokenAddress, tokenAbi, customProvider(chain))
    const { symbol: tokenSymbol, decimals: tokenDecimals } = await getContractSymbolAndDecimalsFromFile(tokenAddress, tokenInstance, chain)

    const amount = defactorFn(decodedParams[1], `${tokenDecimals}`)

    const recipientWithLink = await getRecipientNameWithLink(chain, recipientAddress)

    const tokensWithLink = `**${addCommas(amount)} ${addressFormatter(tokenAddress, chain, tokenSymbol)}**`
    const functionDesc = `Create a stream on ${senderContractNameWithLink} to transfer ${tokensWithLink} to ${recipientWithLink}`
    const streamingInfo = `The stream will start at ${formatTimestamp(decodedParams[3])} and end at ${formatTimestamp(decodedParams[4])}.`

    return `🛑 ${functionDesc}. ${streamingInfo}`
  },
}
