import { getContractNameAndAbiFromFile } from '../abi-utils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from '../compound-types'
import { addCommas, formatTimestamp, getContractSymbolAndDecimalsFromFile, getPlatform, getRecipientNameWithLink } from './helper'
import { customProvider } from './../../../utils/clients/ethers'
import { defactorFn } from './../../../utils/roundingUtils'
import { Contract } from 'ethers'

export const sablierFormatters: { [functionName: string]: TransactionFormatter } = {
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

    return `🛑 Create a stream on **[${senderName}](https://${platform}/address/${senderAddress})** to transfer **${addCommas(
      amount
    )} [${tokenSymbol}](https://${platform}/address/${tokenAddress})** to ${recipientWithLink}. The stream will start at ${formatTimestamp(
      decodedParams[3]
    )} and end at ${formatTimestamp(decodedParams[4])}.`
  },
}
