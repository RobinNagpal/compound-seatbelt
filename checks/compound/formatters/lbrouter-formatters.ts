import { defactorFn } from './../../../utils/roundingUtils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from '../compound-types'
import { BigNumber } from 'ethers';
import { Contract } from 'ethers'
import { getContractNameAndAbiFromFile } from '../abi-utils'
import { customProvider } from './../../../utils/clients/ethers'
import { addCommas, addressFormatter, getContractSymbolAndDecimalsFromFile, getIcon, getRecipientNameWithLink, IconType } from './helper'

export const lbrouterFormatters: { [functionName: string]: TransactionFormatter } = {
  'swapTokensForExactTokens(uint256,uint256,tuple,address,uint256)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const amountOut = defactorFn(decodedParams[0]); 
    const amountInMax = defactorFn(decodedParams[1]); 
    const path = decodedParams[2].split(',')
    const recipient = await getRecipientNameWithLink(chain, decodedParams[3]); 
    const deadline = decodedParams[4] 
  
    const tokenDetails = await Promise.all(
        path.slice(2).map(async (address: string) => {
          const { abi } = await getContractNameAndAbiFromFile(chain, address);
          const instance = new Contract(address, abi, customProvider(chain));
          const { symbol, decimals } = await getContractSymbolAndDecimalsFromFile(address, instance, chain);
          return { symbol, decimals, address };
        })
      );
    
      const formattedPath = tokenDetails.map(({ symbol }) => symbol).join(' → ');
  
    const details = `Swap up to **${amountInMax}** for exactly **${amountOut}** using the route **${formattedPath}**, sending the tokens to **${recipient}** before **${deadline}**.`;
  
    return { summary: details, details };
  },
}
