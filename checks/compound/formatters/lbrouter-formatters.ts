import { defactorFn } from './../../../utils/roundingUtils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from '../compound-types'
import { Contract } from 'ethers'
import { getContractNameAndAbiFromFile } from '../abi-utils'
import { customProvider } from './../../../utils/clients/ethers'
import { addCommas, addressFormatter, getContractSymbolAndDecimalsFromFile, getIcon, getRecipientNameWithLink, IconType } from './helper'

export const lbrouterFormatters: { [functionName: string]: TransactionFormatter } = {
  'swapTokensForExactTokens(uint256,uint256,tuple,address,uint256)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const recipient = await getRecipientNameWithLink(chain, decodedParams[3])
      
    const path = decodedParams[2].split(',')
    const tokenDetails = await Promise.all(
        path.slice(2).map(async (address: string) => {
          const { abi } = await getContractNameAndAbiFromFile(chain, address)
          const instance = new Contract(address, abi, customProvider(chain))
          const { symbol, decimals } = await getContractSymbolAndDecimalsFromFile(address, instance, chain)
          return { symbol, decimals, address }
        })
      );
    
    const inputToken = tokenDetails[0] // First token in the path
    const outputToken = tokenDetails[tokenDetails.length - 1] // Last token in the path
    
    const formattedPath = tokenDetails.map(({ symbol }) => symbol).join(' → ')
    
    const amountOut = defactorFn(decodedParams[0], outputToken.decimals)
    const amountInMax = defactorFn(decodedParams[1], inputToken.decimals)
    
    const inputAmountAndSymbol = `${addCommas(amountInMax)} ${addressFormatter(inputToken.address, chain, inputToken.symbol)}`
    const outputAmountAndSymbol = `${addCommas(amountOut)} ${addressFormatter(outputToken.address, chain, outputToken.symbol)}`
    
    const details = `${getIcon(IconType.Convert)} Swap **${inputAmountAndSymbol}** for **${outputAmountAndSymbol}** using the route **${formattedPath}**, and send the tokens to ${recipient}.`
    
    return { summary: details, details };
  },
}
