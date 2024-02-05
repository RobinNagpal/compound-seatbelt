import { BigNumber } from '@ethersproject/bignumber'
import { Contract } from 'ethers'
import { customProvider } from '../../../utils/clients/ethers'
import { getContractNameAndAbiFromFile } from './../abi-utils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from './../compound-types'
import {
  calculateDifferenceOfDecimals,
  defactor,
  getContractSymbolAndDecimalsFromFile,
  getFormatCompTokens,
  getFormattedTokenNameWithLink,
  getPercentageForTokenFactor,
  getPlatform,
} from './helper'

export const comptrollerFormatters: { [functionName: string]: TransactionFormatter } = {
  '_grantComp(address,uint256)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    const platform = await getPlatform(chain)

    let { contractName } = await getContractNameAndAbiFromFile(chain, decodedParams[0])

    contractName = contractName === '' ? 'Wallet' : contractName

    const { abi } = await getContractNameAndAbiFromFile(chain, transaction.target)
    const currentInstance = new Contract(transaction.target, abi, customProvider(chain))

    const compAddress = await currentInstance.callStatic.getCompAddress()
    const { abi: compAddressAbi } = await getContractNameAndAbiFromFile(chain, compAddress)
    const compInstance = new Contract(compAddress, compAddressAbi, customProvider(chain))
    const { symbol } = await getContractSymbolAndDecimalsFromFile(compAddress, compInstance, chain)

    const numberOfCompTokens = decodedParams[1]
    const formattedCompTokens = getFormatCompTokens(numberOfCompTokens)
    return `\n\nGrant **${formattedCompTokens} [${symbol}](https://${platform}/address/${compAddress})** tokens to [${contractName}](https://${platform}/address/${decodedParams[0]}).`
  },
  '_setCompSpeeds(address[],uint256[],uint256[])': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
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
      return `\n\nSet [${symbol}](https://${platform}/address/${targetToken}) collateral factor from ${prevValue} to ${newValue}%`
    }

    return `\n\nSet [${symbol}](https://${platform}/address/${targetToken}) collateral factor to ${newValue}%`
  },
  '_setMarketBorrowCaps(address[],uint256[])': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    const platform = await getPlatform(chain)

    const { abi } = await getContractNameAndAbiFromFile(chain, decodedParams[0])
    const currentInstance = new Contract(decodedParams[0], abi, customProvider(chain))
    const { symbol, decimals } = await getContractSymbolAndDecimalsFromFile(decodedParams[0], currentInstance, chain)

    const { abi: contractAbi } = await getContractNameAndAbiFromFile(chain, transaction.target)
    const contractInstance = new Contract(transaction.target, contractAbi, customProvider(chain))

    const prevValue = defactor(
      await contractInstance.callStatic.borrowCaps(decodedParams[0]),
      parseFloat(`1e${decimals}`)
    )
    const newValue = defactor(BigInt(decodedParams[1]), parseFloat(`1e${decimals}`))

    const changeinCaps = calculateDifferenceOfDecimals(newValue, prevValue)

    return `\n\nSet MarketBorrowCaps of [${symbol}](https://${platform}/address/${
      decodedParams[0]
    }) to ${newValue}. Previous value was ${prevValue} and now it is getting ${
      changeinCaps > 0 ? 'increased' : 'decreased'
    } by **${changeinCaps}**.`
  },
}

function getFormattedCompSpeeds(speedValue: BigNumber | string) {
  const newCompSpeed = defactor(BigInt(speedValue.toString()))
  return newCompSpeed.toFixed(3)
}

function getDefactoredCompSpeeds(speedValue: BigNumber | string) {
  return defactor(BigInt(speedValue.toString()))
}
