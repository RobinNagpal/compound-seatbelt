import { Contract } from 'ethers'
import { customProvider } from '../../../utils/clients/ethers'
import { getContractNameAndAbiFromFile } from './../abi-utils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from './../compound-types'
import {
  addCommas,
  formatAddressesAndAmounts,
  getChangeTextFn,
  getContractSymbolAndDecimalsFromFile,
  getCriticalitySign,
  getFormattedTokenNameWithLink,
  getPlatform,
  getRecipientNameWithLink,
  tab,
} from './helper'
import { defactorFn, percentageFn, subtractFn } from './../../../utils/roundingUtils'

export const comptrollerFormatters: { [functionName: string]: TransactionFormatter } = {
  '_grantComp(address,uint256)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = getPlatform(chain)

    const { abi } = await getContractNameAndAbiFromFile(chain, transaction.target)
    const currentInstance = new Contract(transaction.target, abi, customProvider(chain))

    const compAddress = await currentInstance.callStatic.getCompAddress()
    const { abi: compAddressAbi } = await getContractNameAndAbiFromFile(chain, compAddress)
    const compInstance = new Contract(compAddress, compAddressAbi, customProvider(chain))
    const { symbol } = await getContractSymbolAndDecimalsFromFile(compAddress, compInstance, chain)

    const numberOfCompTokens = defactorFn(decodedParams[1])

    return `🛑 Grant **${addCommas(numberOfCompTokens)} [${symbol}](https://${platform}/address/${compAddress})** tokens to ${await getRecipientNameWithLink(
      chain,
      decodedParams[0]
    )}.`
  },
  '_setCompSpeeds(address[],uint256[],uint256[])': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    if (decodedParams.length === 0 || decodedParams.some((param) => param === '')) {
      return 'No data provided for Comp speeds.'
    }
    const addresses = decodedParams[0].split(',')
    const supplySpeeds = decodedParams[1].split(',')
    const borrowSpeeds = decodedParams[2].split(',')

    let finalText = 'Set CompSpeeds for token(s):\n'

    for (let i = 0; i < addresses.length; i++) {
      const currentAddress = addresses[i]
      const currentBorrowSpeed = borrowSpeeds[i]
      const currentSupplySpeed = supplySpeeds[i]

      const symbol = await getFormattedTokenNameWithLink(chain, currentAddress)

      const { abi: targetAbi } = await getContractNameAndAbiFromFile(chain, transaction.target)
      const currentTargetInstance = new Contract(transaction.target, targetAbi, customProvider(chain))

      const compAddress = await currentTargetInstance.callStatic.getCompAddress()
      const compSymbol = await getFormattedTokenNameWithLink(chain, compAddress)

      const baseText = `Set CompSpeeds for ${symbol}`

      const previousBorrowSpeed = (await currentTargetInstance.callStatic.compBorrowSpeeds(currentAddress)).toString()
      const previousSupplySpeed = (await currentTargetInstance.callStatic.compSupplySpeeds(currentAddress)).toString()

      const changeInSupply = subtractFn(defactorFn(currentSupplySpeed), defactorFn(previousSupplySpeed))

      const changeInBorrow = subtractFn(defactorFn(currentBorrowSpeed), defactorFn(previousBorrowSpeed))

      const prevFormattedBorrowSpeed = defactorFn(previousBorrowSpeed)
      const prevFormattedSupplySpeed = defactorFn(previousSupplySpeed)
      const newFormattedBorrowSpeed = defactorFn(currentBorrowSpeed)
      const newFormattedSupplySpeed = defactorFn(currentSupplySpeed)

      const changeInSpeedsText = (type: string, changeInSpeed: string, prevFormattedValue: string, newFormattedValue: string) => {
        return `${type} speed of ${symbol} to ${newFormattedValue} ${compSymbol}/block which was previously ${prevFormattedValue} ${compSymbol}/block ${getChangeTextFn(
          changeInSpeed
        )}`
      }

      const supplySpeedText = changeInSpeedsText('Supply', changeInSupply, prevFormattedSupplySpeed, newFormattedSupplySpeed)
      const borrowSpeedText = changeInSpeedsText('Borrow', changeInBorrow, prevFormattedBorrowSpeed, newFormattedBorrowSpeed)

      finalText += `${tab}* ${baseText}. ${supplySpeedText} ${borrowSpeedText}`
      if (i < addresses.length - 1) {
        finalText += '\n'
      }
    }

    return finalText
  },
  '_setCollateralFactor(address,uint256)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = getPlatform(chain)
    const { abi: comptrollerAbi } = await getContractNameAndAbiFromFile(chain, transaction.target)
    const comptrollerInstance = new Contract(transaction.target, comptrollerAbi, customProvider(chain))
    const targetToken = decodedParams[0]
    const currentValue = (await comptrollerInstance.callStatic.markets(targetToken))?.[1]

    const { abi } = await getContractNameAndAbiFromFile(chain, targetToken)
    const coinInstance = new Contract(targetToken, abi, customProvider(chain))

    const { symbol } = await getContractSymbolAndDecimalsFromFile(targetToken, coinInstance, chain)
    const newValue = percentageFn(defactorFn(decodedParams[1]))

    if (currentValue) {
      const prevValue = percentageFn(defactorFn(currentValue.toString()))
      const changeInFactor = subtractFn(newValue, prevValue)

      return `${getCriticalitySign(
        changeInFactor,
        15
      )} Set **[${symbol}](https://${platform}/address/${targetToken})** collateral factor from ${prevValue}% to ${newValue}% ${getChangeTextFn(
        changeInFactor,
        true
      )}`
    }

    return `Set **[${symbol}](https://${platform}/address/${targetToken})** collateral factor to ${newValue}%`
  },
  '_setMarketBorrowCaps(address[],uint256[])': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    if (decodedParams.length === 0 || decodedParams.some((param) => param === '')) {
      return 'No data provided for Borrow Caps.'
    }
    const platform = getPlatform(chain)

    const addresses = decodedParams[0].split(',')
    const values = decodedParams[1].split(',')

    let finalText = 'Set MarketBorrowCaps for token(s):\n'

    for (let i = 0; i < addresses.length; i++) {
      const currentAddress = addresses[i]
      const currentValue = values[i]

      const { abi } = await getContractNameAndAbiFromFile(chain, currentAddress)
      const cTokenInstance = new Contract(currentAddress, abi, customProvider(chain))
      const { symbol } = await getContractSymbolAndDecimalsFromFile(currentAddress, cTokenInstance, chain)

      // There is no underlying asset for the address
      if (currentAddress === '0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5') {
        finalText += `${tab}* Set MarketBorrowCaps of **[${symbol}](https://${platform}/address/${currentAddress})** to ${addCommas(defactorFn(currentValue))}`
        if (i < addresses.length - 1) {
          finalText += '\n'
        }
        continue
      }
      const underlyingAssetAddress = await cTokenInstance.callStatic.underlying()
      const { abi: assetAbi } = await getContractNameAndAbiFromFile(chain, underlyingAssetAddress)
      const assetInstance = new Contract(underlyingAssetAddress, assetAbi, customProvider(chain))
      const { decimals: assetDecimals } = await getContractSymbolAndDecimalsFromFile(underlyingAssetAddress, assetInstance, chain)
      const { abi: contractAbi, contractName } = await getContractNameAndAbiFromFile(chain, transaction.target)
      const contractInstance = new Contract(transaction.target, contractAbi, customProvider(chain))
      const borrowCaps = (await contractInstance.callStatic.borrowCaps(currentAddress)).toString()
      const prevValue = defactorFn(borrowCaps, `${assetDecimals}`)
      const newValue = defactorFn(currentValue, `${assetDecimals}`)

      const changeInCaps = subtractFn(newValue, prevValue)

      finalText += `${tab}* ${getCriticalitySign(
        changeInCaps,
        100
      )} Set MarketBorrowCaps of **[${symbol}](https://${platform}/address/${currentAddress})** via **[${contractName}](https://${platform}/address/${
        transaction.target
      })** from ${addCommas(prevValue)} to ${addCommas(newValue)} ${getChangeTextFn(changeInCaps)}.`

      if (i < addresses.length - 1) {
        finalText += '\n'
      }
    }

    return finalText
  },
  '_setPriceOracle(address)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = getPlatform(chain)
    const targetAddress = transaction.target
    const { abi } = await getContractNameAndAbiFromFile(chain, targetAddress)
    const targetInstance = new Contract(targetAddress, abi, customProvider(chain))

    const prevValue = await targetInstance.callStatic.oracle()
    const newValue = decodedParams[0]

    return `⚠️ Set new price oracle to **[${newValue}](https://${platform}/address/${newValue})**. Previous oracle was **[${prevValue}](https://${platform}/address/${prevValue})**.`
  },
  '_setMintPaused(address,bool)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = getPlatform(chain)

    const coinLink = await getFormattedTokenNameWithLink(chain, decodedParams[0])
    const { contractName } = await getContractNameAndAbiFromFile(chain, transaction.target)

    return `⚠️ ${decodedParams[1] === 'true' ? 'Pause' : 'Resume'} minting for ${coinLink} via **[${contractName}](https://${platform}/address/${
      transaction.target
    })**.`
  },
  '_setBorrowPaused(address,bool)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = getPlatform(chain)

    const coinLink = await getFormattedTokenNameWithLink(chain, decodedParams[0])
    const { contractName } = await getContractNameAndAbiFromFile(chain, transaction.target)

    return `⚠️ ${decodedParams[1] === 'true' ? 'Pause' : 'Resume'} ${coinLink} borrowing via **[${contractName}](https://${platform}/address/${
      transaction.target
    })**.`
  },
  '_setSeizePaused(bool)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = getPlatform(chain)

    const { contractName } = await getContractNameAndAbiFromFile(chain, transaction.target)

    return `⚠️ ${decodedParams[0] === 'true' ? 'Pause' : 'Unpause'} market liquidation via **[${contractName}](https://${platform}/address/${
      transaction.target
    })**.`
  },
  '_setContributorCompSpeed(address,uint256)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = getPlatform(chain)

    const { abi, contractName } = await getContractNameAndAbiFromFile(chain, transaction.target)

    const targetInstance = new Contract(transaction.target, abi, customProvider(chain))

    const prevValue = defactorFn((await targetInstance.callStatic.compContributorSpeeds(decodedParams[0])).toString())
    const newValue = defactorFn(decodedParams[1])

    const changeInSpeed = subtractFn(newValue, prevValue)

    return `Set ContributorCompSpeed for **[${decodedParams[0]}](https://${platform}/address/${
      decodedParams[0]
    })** via **[${contractName}](https://${platform}/address/${transaction.target})** from ${addCommas(prevValue)} to ${addCommas(newValue)} ${getChangeTextFn(
      changeInSpeed
    )}.`
  },
  '_supportMarket(address)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const marketLink = await getFormattedTokenNameWithLink(chain, decodedParams[0])

    return `Support ${marketLink} on Compound.`
  },
  '_setPauseGuardian(address)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = getPlatform(chain)

    const { contractName: targetContractName } = await getContractNameAndAbiFromFile(chain, transaction.target)
    const { contractName: guardianContractName } = await getContractNameAndAbiFromFile(chain, decodedParams[0])

    return `🛑 Set the Pause Guardian to ${await getRecipientNameWithLink(chain, decodedParams[0])} via **[${targetContractName}](https://${platform}/address/${
      transaction.target
    })**.`
  },
  '_become(address)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = getPlatform(chain)

    const targetAddress = transaction.target
    const newImplmentationAddress = decodedParams[0]

    return `🛑 Upgrade of the Compound Comptroller contract to a new implementation **[${newImplmentationAddress}](https://${platform}/address/${newImplmentationAddress})** from **[${targetAddress}](https://${platform}/address/${targetAddress})**.`
  },
  'fixBadAccruals(address[],uint256[])': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = getPlatform(chain)
    const addressesList = decodedParams[0].split(',')
    const amountsList = decodedParams[1].split(',')

    return `🛑 Fix over-accrued COMP tokens of the addresses by their respective amounts:\n\n${formatAddressesAndAmounts(addressesList, amountsList, platform)}`
  },
}
