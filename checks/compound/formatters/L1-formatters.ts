import { Contract } from 'ethers'
import { getContractNameAndAbiFromFile } from '../abi-utils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from './../compound-types'
import { defactor, getContractSymbolAndDecimalsFromFile, getPlatform } from './helper'
import { customProvider } from '../../../utils/clients/ethers'

export const L1Formatters: { [functionName: string]: TransactionFormatter } = {
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

    return `\n\nBridge ${amount.toFixed(
      2
    )} [${tokenSymbol}](https://${platform}/address/${tokenAddress}) tokens over Arbitrum to [${
      decodedParams[2]
    }](https://arbiscan.io/address/${decodedParams[2]})`
  },
}
