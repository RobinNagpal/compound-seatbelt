import { BigNumber } from '@ethersproject/bignumber'
import { Contract } from 'ethers'
import { customProvider } from '../../../utils/clients/ethers'
import { getContractNameAndAbiFromFile } from './../abi-utils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from './../compound-types'
import {
  calculateDifferenceOfDecimals,
  defactor,
  getChangeText,
  getContractSymbolAndDecimalsFromFile,
  getFormatCompTokens,
  getFormattedTokenNameWithLink,
  getPercentageForTokenFactor,
  getPlatform,
  getRecipientNameWithLink,
} from './helper'

export const comptrollerFormatters: { [functionName: string]: TransactionFormatter } = {
  '_grantComp(address,uint256)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    const platform = await getPlatform(chain)

    const { abi } = await getContractNameAndAbiFromFile(chain, transaction.target)
    const currentInstance = new Contract(transaction.target, abi, customProvider(chain))

    const compAddress = await currentInstance.callStatic.getCompAddress()
    const { abi: compAddressAbi } = await getContractNameAndAbiFromFile(chain, compAddress)
    const compInstance = new Contract(compAddress, compAddressAbi, customProvider(chain))
    const { symbol } = await getContractSymbolAndDecimalsFromFile(compAddress, compInstance, chain)

    const numberOfCompTokens = decodedParams[1]
    const formattedCompTokens = getFormatCompTokens(numberOfCompTokens)
    return `\n\nGrant **${formattedCompTokens} [${symbol}](https://${platform}/address/${compAddress})** tokens to ${getRecipientNameWithLink(
      chain,
      decodedParams[0]
    )}.`
  },
  '_setCompSpeeds(address[],uint256[],uint256[])': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    if (decodedParams.length === 0 || decodedParams.some((param) => param === '')) {
      return 'No data provided for Comp speeds.'
    }
    const addresses = decodedParams[0].split(',')
    const borrowSpeeds = decodedParams[1].split(',')
    const supplySpeeds = decodedParams[2].split(',')

    let finalText = ''

    for (let i = 0; i < addresses.length; i++) {
      const currentAddress = addresses[i]
      const currentBorrowSpeed = borrowSpeeds[i]
      const currentSupplySpeed = supplySpeeds[i]

      const symbol = await getFormattedTokenNameWithLink(chain, currentAddress)

      const { abi: targetAbi } = await getContractNameAndAbiFromFile(chain, transaction.target)
      const currentTargetInstance = new Contract(transaction.target, targetAbi, customProvider(chain))

      const compAddress = await currentTargetInstance.callStatic.getCompAddress()
      const compSymbol = await getFormattedTokenNameWithLink(chain, compAddress)

      const baseText = `\n\nSet CompSpeeds for ${symbol}`

      const previousBorrowSpeed = await currentTargetInstance.callStatic.compBorrowSpeeds(currentAddress)
      const previousSupplySpeed = await currentTargetInstance.callStatic.compSupplySpeeds(currentAddress)

      const changeInSupply = calculateDifferenceOfDecimals(
        getDefactoredCompSpeeds(currentSupplySpeed),
        getDefactoredCompSpeeds(previousSupplySpeed)
      )

      const changeInBorrow = calculateDifferenceOfDecimals(
        getDefactoredCompSpeeds(currentBorrowSpeed),
        getDefactoredCompSpeeds(previousBorrowSpeed)
      )

      const prevFormattedBorrowSpeed = getFormattedCompSpeeds(previousBorrowSpeed)
      const prevFormattedSupplySpeed = getFormattedCompSpeeds(previousSupplySpeed)
      const newFormattedBorrowSpeed = getFormattedCompSpeeds(currentBorrowSpeed)
      const newFormattedSupplySpeed = getFormattedCompSpeeds(currentSupplySpeed)

      const changeInSpeedsText = (
        type: string,
        changeInSpeed: number,
        prevFormattedValue: string,
        newFormattedValue: string
      ) => {
        const change = changeInSpeed
          ? `It's now getting ${changeInSpeed > 0 ? 'increased' : 'decreased'} by **${changeInSpeed}%**`
          : 'It remains the same.'

        return `${type} speed of ${symbol} to ${newFormattedValue} ${compSymbol}/block which was previously ${prevFormattedValue} ${compSymbol}/block (${change}).`
      }

      const supplySpeedText = changeInSpeedsText(
        'Supply',
        changeInSupply,
        prevFormattedSupplySpeed,
        newFormattedSupplySpeed
      )
      const borrowSpeedText = changeInSpeedsText(
        'Borrow',
        changeInBorrow,
        prevFormattedBorrowSpeed,
        newFormattedBorrowSpeed
      )

      finalText += `${baseText}. ${supplySpeedText} ${borrowSpeedText}\n`
    }

    return finalText
  },
  '_setCollateralFactor(address,uint256)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    const platform = await getPlatform(chain)
    const { abi: comptrollerAbi } = await getContractNameAndAbiFromFile(chain, transaction.target)
    const comptrollerInstance = new Contract(transaction.target, comptrollerAbi, customProvider(chain))
    const targetToken = decodedParams[0]
    const currentValue = (await comptrollerInstance.callStatic.markets(targetToken))?.[1]

    const { abi } = await getContractNameAndAbiFromFile(chain, targetToken)
    const coinInstance = new Contract(targetToken, abi, customProvider(chain))

    const { symbol } = await getContractSymbolAndDecimalsFromFile(targetToken, coinInstance, chain)

    const newValue = getPercentageForTokenFactor(decodedParams[1])
    const token = defactor(BigInt(decodedParams[1]))

    if (currentValue) {
      const prevValue = getPercentageForTokenFactor(currentValue)
      return `\n\nSet [${symbol}](https://${platform}/address/${targetToken}) collateral factor from ${prevValue}% to ${newValue}%`
    }

    return `\n\nSet [${symbol}](https://${platform}/address/${targetToken}) collateral factor to ${newValue}%`
  },
  '_setMarketBorrowCaps(address[],uint256[])': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    if (decodedParams.length === 0 || decodedParams.some((param) => param === '')) {
      return 'No data provided for Borrow Caps.'
    }
    const platform = await getPlatform(chain)

    const addresses = decodedParams[0].split(',')
    const values = decodedParams[1].split(',')

    let finalText = ''

    for (let i = 0; i < addresses.length; i++) {
      const currentAddress = addresses[i]
      const currentValue = values[i]

      const { abi } = await getContractNameAndAbiFromFile(chain, currentAddress)
      const cTokenInstance = new Contract(currentAddress, abi, customProvider(chain))
      const { symbol } = await getContractSymbolAndDecimalsFromFile(currentAddress, cTokenInstance, chain)
      const underlyingAssetAddress = await cTokenInstance.callStatic.underlying()
      const { abi: assetAbi } = await getContractNameAndAbiFromFile(chain, underlyingAssetAddress)
      const assetInstance = new Contract(underlyingAssetAddress, assetAbi, customProvider(chain))
      const { decimals: assetDecimals } = await getContractSymbolAndDecimalsFromFile(
        underlyingAssetAddress,
        assetInstance,
        chain
      )
      const { abi: contractAbi, contractName } = await getContractNameAndAbiFromFile(chain, transaction.target)
      const contractInstance = new Contract(transaction.target, contractAbi, customProvider(chain))

      const prevValue = defactor(
        await contractInstance.callStatic.borrowCaps(currentAddress),
        parseFloat(`1e${assetDecimals}`)
      )
      const newValue = defactor(BigInt(currentValue), parseFloat(`1e${assetDecimals}`))

      const changeInCaps = calculateDifferenceOfDecimals(newValue, prevValue)

      finalText += `\n\nSet MarketBorrowCaps of [${symbol}](https://${platform}/address/${currentAddress}) to ${newValue} via [${contractName}](https://${platform}/address/${
        transaction.target
      }). Previous value was ${prevValue} and ${getChangeText(changeInCaps)}.`
    }

    return finalText
  },
  '_setPriceOracle(address)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    const platform = await getPlatform(chain)
    const targetAddress = transaction.target
    const { abi } = await getContractNameAndAbiFromFile(chain, targetAddress)
    const targetInstance = new Contract(targetAddress, abi, customProvider(chain))

    const prevValue = await targetInstance.callStatic.oracle()
    const newValue = decodedParams[0]

    return `\n\nSet new price oracle to [${newValue}](https://${platform}/address/${newValue}). Previous oracle was [${prevValue}](https://${platform}/address/${prevValue}).`
  },
  '_setMintPaused(address,bool)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    const platform = await getPlatform(chain)

    const coinLink = await getFormattedTokenNameWithLink(chain, decodedParams[0])
    const { contractName } = await getContractNameAndAbiFromFile(chain, transaction.target)

    return `\n\n${
      decodedParams[1] === 'true' ? 'Pause' : 'Resume'
    } minting for ${coinLink} via [${contractName}](https://${platform}/address/${transaction.target}).`
  },
  '_setBorrowPaused(address,bool)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    const platform = await getPlatform(chain)

    const coinLink = await getFormattedTokenNameWithLink(chain, decodedParams[0])
    const { contractName } = await getContractNameAndAbiFromFile(chain, transaction.target)

    return `\n\n${
      decodedParams[1] === 'true' ? 'Pause' : 'Resume'
    } ${coinLink} borrowing via [${contractName}](https://${platform}/address/${transaction.target}).`
  },
  '_setSeizePaused(bool)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = await getPlatform(chain)

    const { contractName } = await getContractNameAndAbiFromFile(chain, transaction.target)

    return `\n\n${
      decodedParams[0] === 'true' ? 'Pause' : 'Unpause'
    } market liquidation via [${contractName}](https://${platform}/address/${transaction.target}).`
  },
  '_setContributorCompSpeed(address,uint256)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    const platform = await getPlatform(chain)

    const { abi, contractName } = await getContractNameAndAbiFromFile(chain, transaction.target)

    const targetInstance = new Contract(transaction.target, abi, customProvider(chain))

    const prevValue = await targetInstance.callStatic.compContributorSpeeds(decodedParams[0])
    const newValue = parseFloat(decodedParams[1])

    const changeInSpeed = calculateDifferenceOfDecimals(newValue, prevValue)

    return `\n\nSet ContributorCompSpeed for [${decodedParams[0]}](https://${platform}/address/${
      decodedParams[0]
    }) to **${newValue}** via [${contractName}](https://${platform}/address/${
      transaction.target
    }). Previous value was **${prevValue}** and ${getChangeText(changeInSpeed)}.`
  },
  '_supportMarket(address)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    const marketLink = await getFormattedTokenNameWithLink(chain, decodedParams[0])

    return `\n\nSupport ${marketLink} on Compound.`
  },
  '_setPauseGuardian(address)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    const platform = await getPlatform(chain)

    const { contractName: targetContractName } = await getContractNameAndAbiFromFile(chain, transaction.target)
    const { contractName: guardianContractName } = await getContractNameAndAbiFromFile(chain, decodedParams[0])

    return `\n\nSet the Pause Guardian to [${guardianContractName}](https://${platform}/address/${decodedParams[0]}) via [${targetContractName}](https://${platform}/address/${transaction.target}).`
  },
}

function getFormattedCompSpeeds(speedValue: BigNumber | string) {
  const newCompSpeed = defactor(BigInt(speedValue.toString()))
  return newCompSpeed.toFixed(3)
}

function getDefactoredCompSpeeds(speedValue: BigNumber | string) {
  return defactor(BigInt(speedValue.toString()))
}
