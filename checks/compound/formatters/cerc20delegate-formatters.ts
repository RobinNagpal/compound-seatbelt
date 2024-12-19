import { getContractNameAndAbiFromFile } from '../abi-utils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from '../compound-types'
import { addCommas, addressFormatter, getChangeTextFn, getContractSymbolAndDecimalsFromFile, getFormattedTokenNameWithLink, getIcon, getPlatform, IconType, tab } from './helper'
import { customProvider } from './../../../utils/clients/ethers'
import { defactorFn, percentageFn, subtractFn } from './../../../utils/roundingUtils'
import { Contract } from 'ethers'

export const cerc20DelegateFormatters: { [functionName: string]: TransactionFormatter } = {
  '_setReserveFactor(uint256)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const tokenAddress = transaction.target
    const { abi } = await getContractNameAndAbiFromFile(chain, tokenAddress)
    const coinInstance = new Contract(tokenAddress, abi, customProvider(chain))
    const prevReserveFactor = await coinInstance.callStatic.reserveFactorMantissa()

    const newReserve = decodedParams[0]
    const newReservePercentage = percentageFn(defactorFn(newReserve))

    const tokenNameWithLink = await getFormattedTokenNameWithLink(chain, tokenAddress)
    const prevReservePercentage = percentageFn(defactorFn(prevReserveFactor.toString()))

    const changeInReserveFactor = subtractFn(newReservePercentage, prevReservePercentage)

    const functionDesc = `Set reserve factor for ${tokenNameWithLink}`

    if (prevReserveFactor && prevReservePercentage !== newReservePercentage) {
      const rawChanges = `Update from ${prevReserveFactor} to ${newReserve}`
      const normalizedChanges = `Update from ${prevReservePercentage}% to ${newReservePercentage}% ${getChangeTextFn(changeInReserveFactor, true)}`

      return `${functionDesc}.\n\n${tab}**Changes:**${normalizedChanges}\n\n${tab}**Raw Changes:**${rawChanges}`
    }

    return `Set reserve factor for ${tokenNameWithLink}\n\n${tab}  **Changes:** ${newReservePercentage}%\n\n${tab}  **Raw Changes: ${newReserve}**`
  },

  '_reduceReserves(uint256)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
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
    const reduceValueRaw = decodedParams[0]
    const reduceValue = defactorFn(reduceValueRaw, `${assetDecimals}`)

    const totalReservesNew = subtractFn(totalReservesFormatted, reduceValue)

    const functionDesc = `Reduce reserves of **${addressFormatter(cTokenAddress, chain, cTokenSymbol)}**`
    const reducedReserves = `${addCommas(reduceValue)} ${addressFormatter(underlyingAssetAddress, chain, assetSymbol)}`
    const normalizedChanges = `${reducedReserves}. Remaining total reserves would be ${addCommas(totalReservesNew)}`
    const rawChanges = `${reduceValueRaw}`

    return `${functionDesc}\n\n${tab}  **Changes:** ${normalizedChanges}\n\n${tab}  **Raw Changes:** ${rawChanges}`
  },
  '_setInterestRateModel(address)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const coinLink = await getFormattedTokenNameWithLink(chain, transaction.target)

    const details = `${getIcon(IconType.Update)} Update the **${addressFormatter(decodedParams[0], chain, 'interest rate model')}** for ${coinLink}.`
    return { summary: details, details }
  },

  'redeem(uint256)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
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

    const redeemInfo = `**${addCommas(underlyingAssetTokens)} ${addressFormatter(underlyingAssetAddress, chain, assetSymbol)}**`
    const normalizedChanges = `Redeem **${addCommas(cTokens)} ${addressFormatter(
      transaction.target,
      chain,
      cTokenSymbol
    )}** cTokens in exchange for ${redeemInfo}`

    return `Redeem tokens\n\n${tab}**Changes:**${normalizedChanges} \n\n${tab}**Raw Changes:** Redeem ${decodedParams[0]} cTokens`
  },
}
