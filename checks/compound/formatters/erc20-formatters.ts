import { Contract } from 'ethers'
import { customProvider } from '../../../utils/clients/ethers'
import { getContractNameAndAbiFromFile } from '../abi-utils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from '../compound-types'
import {
  getContractSymbolAndDecimalsFromFile,
  getFormattedTokenWithLink,
  getPercentageForTokenFactor,
  getPlatform,
} from './helper'

export const ERC20Formatters: { [functionName: string]: TransactionFormatter } = {
  'transfer(address,uint256)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    console.log(`decodedParams ${decodedParams.join(',')}`)

    const formattedTokenWithLink = await getFormattedTokenWithLink(chain, transaction.target, decodedParams[1])

    return `\n\nTransfer ${formattedTokenWithLink} to ${decodedParams[0]}.`
  },
  'approve(address,uint256)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    console.log(`decodedParams ${decodedParams.join(',')}`)
    const platform = await getPlatform(chain)

    const { contractName } = await getContractNameAndAbiFromFile(chain, decodedParams[0])

    const tokenAddress = transaction.target
    const formattedTokenWithLink = await getFormattedTokenWithLink(chain, tokenAddress, decodedParams[1])
    return `\n\nApprove ${formattedTokenWithLink} tokens to [${contractName}](https://${platform}/address/${decodedParams[0]})`
  },
  '_setReserveFactor(uint256)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    console.log(`decodedParams ${decodedParams.join(',')}`)
    const platform = await getPlatform(chain)

    const { abi } = await getContractNameAndAbiFromFile(chain, transaction.target)
    const coinInstance = new Contract(transaction.target, abi, customProvider(chain))
    const prevReserveFactor = await coinInstance.callStatic.reserveFactorMantissa()
    const { symbol } = await getContractSymbolAndDecimalsFromFile(transaction.target, coinInstance, chain)

    const newReserveFactor = getPercentageForTokenFactor(decodedParams[0])
    const tokenUrl = `https://${platform}/address/${transaction.target}`
    if (prevReserveFactor) {
      const prevReserve = getPercentageForTokenFactor(prevReserveFactor)
      return `\n\nSet reserve factor for [${symbol}](${tokenUrl}) from ${prevReserve}% to ${newReserveFactor}%`
    }
    return `\n\nSet reserve factor for [${symbol}](${tokenUrl}) to ${newReserveFactor}%`
  },
}
