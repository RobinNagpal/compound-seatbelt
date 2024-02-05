import { Contract } from 'ethers'
import { customProvider } from '../../../utils/clients/ethers'
import { getContractNameAndAbiFromFile } from '../abi-utils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from '../compound-types'
import {
  getFormattedTokenNameWithLink,
  getFormattedTokenWithLink,
  getPercentageForTokenFactor,
  getRecipientNameWithLink,
} from './helper'

export const ERC20Formatters: { [functionName: string]: TransactionFormatter } = {
  'transfer(address,uint256)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    const formattedTokenWithLink = await getFormattedTokenWithLink(chain, transaction.target, decodedParams[1])
    return `\n\nTransfer ${formattedTokenWithLink} to ${getRecipientNameWithLink(chain, decodedParams[0])}.`
  },
  'approve(address,uint256)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    const tokenAddress = transaction.target
    const formattedTokenWithLink = await getFormattedTokenWithLink(chain, tokenAddress, decodedParams[1])
    return `\n\nApprove ${formattedTokenWithLink} tokens to ${getRecipientNameWithLink(chain, decodedParams[0])}`
  },
  '_setReserveFactor(uint256)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    const tokenAddress = transaction.target
    const { abi } = await getContractNameAndAbiFromFile(chain, tokenAddress)
    const coinInstance = new Contract(tokenAddress, abi, customProvider(chain))
    const prevReserveFactor = await coinInstance.callStatic.reserveFactorMantissa()

    const newReserveFactor = getPercentageForTokenFactor(decodedParams[0])

    const tokenNameWithLink = await getFormattedTokenNameWithLink(chain, tokenAddress)
    if (prevReserveFactor) {
      const prevReserve = getPercentageForTokenFactor(prevReserveFactor)
      return `\n\nSet reserve factor for ${tokenNameWithLink} from ${prevReserve}% to ${newReserveFactor}%`
    }

    return `\n\nSet reserve factor for ${tokenNameWithLink} to ${newReserveFactor}%`
  },
}
