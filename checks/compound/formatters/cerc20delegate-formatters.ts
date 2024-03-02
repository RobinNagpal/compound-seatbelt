import { getContractNameAndAbiFromFile } from '../abi-utils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from '../compound-types'
import { addCommas, getContractSymbolAndDecimalsFromFile, getFormattedTokenNameWithLink, getPlatform } from './helper'
import { customProvider } from './../../../utils/clients/ethers'
import { defactorFn, percentageFn, subtractFn } from './../../../utils/roundingUtils'
import { Contract } from 'ethers'

export const cerc20DelegateFormatters: { [functionName: string]: TransactionFormatter } = {
  '_setReserveFactor(uint256)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const tokenAddress = transaction.target
    const { abi } = await getContractNameAndAbiFromFile(chain, tokenAddress)
    const coinInstance = new Contract(tokenAddress, abi, customProvider(chain))
    const prevReserveFactor = await coinInstance.callStatic.reserveFactorMantissa()

    const newReserveFactor = percentageFn(defactorFn(decodedParams[0]))

    const tokenNameWithLink = await getFormattedTokenNameWithLink(chain, tokenAddress)
    const prevReserve = percentageFn(defactorFn(prevReserveFactor.toString()))
    if (prevReserveFactor && prevReserve !== newReserveFactor) {
      return `Set reserve factor for ${tokenNameWithLink} from ${prevReserve}% to ${newReserveFactor}%`
    }

    return `Set reserve factor for ${tokenNameWithLink} to ${newReserveFactor}%`
  },

  '_reduceReserves(uint256)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = getPlatform(chain)

    const cTokenAddress = transaction.target
    const { abi: cTokenAbi } = await getContractNameAndAbiFromFile(chain, cTokenAddress)
    const cTokenInstance = new Contract(cTokenAddress, cTokenAbi, customProvider(chain))
    const { symbol: cTokenSymbol, decimals: cTokenDecimals } = await getContractSymbolAndDecimalsFromFile(cTokenAddress, cTokenInstance, chain)

    const underlyingAssetAddress = await cTokenInstance.callStatic.underlying()
    const totalReserves = (await cTokenInstance.callStatic.totalReserves()).toString()

    const { abi: assetAbi } = await getContractNameAndAbiFromFile(chain, underlyingAssetAddress)
    const assetInstance = new Contract(underlyingAssetAddress, assetAbi, customProvider(chain))
    const { symbol: assetSymbol, decimals: assetDecimals } = await getContractSymbolAndDecimalsFromFile(underlyingAssetAddress, assetInstance, chain)

    const totalReservesFormatted = defactorFn(totalReserves, `${cTokenDecimals}`)
    const reduceValue = defactorFn(decodedParams[0], `${assetDecimals}`)

    const totalReservesNew = subtractFn(totalReservesFormatted, reduceValue)

    return `Reduce reserves of **[${cTokenSymbol}](https://${platform}/address/${cTokenAddress})** by **${addCommas(
      reduceValue
    )} [${assetSymbol}](https://${platform}/address/${underlyingAssetAddress})**. Remaining total reserves would be ${addCommas(totalReservesNew)}`
  },
  '_setInterestRateModel(address)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = getPlatform(chain)

    const coinLink = await getFormattedTokenNameWithLink(chain, transaction.target)

    return `Set **[interest rate model](https://${platform}/address/${decodedParams[0]})** for ${coinLink}.`
  },

  'redeem(uint256)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = getPlatform(chain)

    const cTokenAddress = transaction.target
    const { abi: cTokenAbi } = await getContractNameAndAbiFromFile(chain, cTokenAddress)
    const cTokenInstance = new Contract(cTokenAddress, cTokenAbi, customProvider(chain))
    const { symbol: cTokenSymbol, decimals: cTokenDecimals } = await getContractSymbolAndDecimalsFromFile(cTokenAddress, cTokenInstance, chain)

    const underlyingAssetAddress = await cTokenInstance.callStatic.underlying()

    const { abi: assetAbi } = await getContractNameAndAbiFromFile(chain, underlyingAssetAddress)
    const assetInstance = new Contract(underlyingAssetAddress, assetAbi, customProvider(chain))
    const { symbol: assetSymbol, decimals: assetDecimals } = await getContractSymbolAndDecimalsFromFile(underlyingAssetAddress, assetInstance, chain)

    const cTokens = defactorFn(decodedParams[0], `${cTokenDecimals}`)
    const underlyingAssetTokens = defactorFn(decodedParams[0], `${assetDecimals}`)

    return `Redeem **${addCommas(cTokens)} [${cTokenSymbol}](https://${platform}/address/${transaction.target})** cTokens in exchange for **${addCommas(
      underlyingAssetTokens
    )} [${assetSymbol}](https://${platform}/address/${underlyingAssetAddress})**`
  },
}
