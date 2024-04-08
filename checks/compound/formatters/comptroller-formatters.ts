import { Contract } from 'ethers'
import { customProvider } from '../../../utils/clients/ethers'
import { getContractNameAndAbiFromFile } from './../abi-utils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from './../compound-types'
import {
  addCommas,
  addressFormatter,
  formatAddressesAndAmounts,
  getChangeTextFn,
  getContractNameWithLink,
  getContractSymbolAndDecimalsFromFile,
  getCriticalitySign,
  getFormattedTokenNameWithLink,
  getPlatform,
  getRecipientNameWithLink,
  tab,
} from './helper'
import { defactorFn, percentageFn, subtractFn } from './../../../utils/roundingUtils'
import { changeThresholds } from '../change-threshold'

export const comptrollerFormatters: { [functionName: string]: TransactionFormatter } = {
  '_grantComp(address,uint256)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const { abi } = await getContractNameAndAbiFromFile(chain, transaction.target)
    const currentInstance = new Contract(transaction.target, abi, customProvider(chain))

    const compAddress = await currentInstance.callStatic.getCompAddress()
    const { abi: compAddressAbi } = await getContractNameAndAbiFromFile(chain, compAddress)
    const compInstance = new Contract(compAddress, compAddressAbi, customProvider(chain))
    const { symbol } = await getContractSymbolAndDecimalsFromFile(compAddress, compInstance, chain)

    const numberOfCompTokens = defactorFn(decodedParams[1])

    return `🛑 Grant **${addCommas(numberOfCompTokens)} ${addressFormatter(compAddress, chain, symbol)}** tokens to ${await getRecipientNameWithLink(
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

      const prevFormattedBorrowSpeed = defactorFn(previousBorrowSpeed)
      const prevFormattedSupplySpeed = defactorFn(previousSupplySpeed)
      const newFormattedBorrowSpeed = defactorFn(currentBorrowSpeed)
      const newFormattedSupplySpeed = defactorFn(currentSupplySpeed)

      const changeInSupply = subtractFn(newFormattedSupplySpeed, prevFormattedSupplySpeed)

      const changeInBorrow = subtractFn(newFormattedBorrowSpeed, prevFormattedBorrowSpeed)

      const changeInSpeedsText = (type: string, changeInSpeed: string, prevFormattedValue: string, newFormattedValue: string) => {
        return `${type} speed of ${symbol} to ${newFormattedValue} ${compSymbol}/block which was previously ${prevFormattedValue} ${compSymbol}/block ${getChangeTextFn(
          changeInSpeed
        )}`
      }

      const changeInSpeedsTextRaw = (type: string, prevValue: string, newValue: string) => {
        return `Update ${type} speed from ${prevValue} to ${newValue}`
      }
      const supplySpeedText = changeInSpeedsText('Supply', changeInSupply, prevFormattedSupplySpeed, newFormattedSupplySpeed)
      const borrowSpeedText = changeInSpeedsText('Borrow', changeInBorrow, prevFormattedBorrowSpeed, newFormattedBorrowSpeed)
      const supplySpeedTextRaw = changeInSpeedsTextRaw('Supply', previousSupplySpeed, currentSupplySpeed)
      const borrowSpeedTextRaw = changeInSpeedsTextRaw('Borrow', previousBorrowSpeed, currentBorrowSpeed)

      finalText += `${tab}* ${baseText}.\n\n${tab}${tab}**Changes:** ${supplySpeedText}.\n${borrowSpeedText}\n\n${tab}${tab}**Raw Changes:** ${supplySpeedTextRaw}.\n${borrowSpeedTextRaw}`
      if (i < addresses.length - 1) {
        finalText += '\n'
      }
    }

    return finalText
  },
  '_setCollateralFactor(address,uint256)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const { abi: comptrollerAbi } = await getContractNameAndAbiFromFile(chain, transaction.target)
    const comptrollerInstance = new Contract(transaction.target, comptrollerAbi, customProvider(chain))
    const targetToken = decodedParams[0]
    const currentValue = (await comptrollerInstance.callStatic.markets(targetToken))?.[1]

    const { abi } = await getContractNameAndAbiFromFile(chain, targetToken)
    const coinInstance = new Contract(targetToken, abi, customProvider(chain))

    const { symbol } = await getContractSymbolAndDecimalsFromFile(targetToken, coinInstance, chain)
    const newValueRaw = decodedParams[1]
    const newValuePercentage = percentageFn(defactorFn(newValueRaw))

    if (currentValue) {
      const prevValueRaw = currentValue.toString()
      const prevValuePercentage = percentageFn(defactorFn(prevValueRaw))
      const changeInFactor = subtractFn(newValuePercentage, prevValuePercentage)

      const thresholds = {
        warningThreshold: changeThresholds.V2.collateralFactorWarningThreshold,
        criticalThreshold: changeThresholds.V2.collateralFactorCriticalThreshold,
      }
      const sign = getCriticalitySign(changeInFactor, thresholds)
      const targetTokenLink = addressFormatter(targetToken, chain, symbol)
      const normalizedChanges = `${prevValuePercentage}% to ${newValuePercentage}% ${getChangeTextFn(changeInFactor, true)}`
      const rawChanges = `Update from ${prevValueRaw} to ${newValueRaw}`

      return `${sign} Set **${targetTokenLink}** collateral factor\n\n${tab}  **Changes:** ${normalizedChanges}\n\n${tab}  **Raw Changes:** ${rawChanges}`
    }

    return `Set **${targetToken}** collateral factor\n\n${tab}  **Changes:** ${newValuePercentage}%\n\n${tab}  **Raw Changes:** ${newValueRaw}`
  },
  '_setMarketBorrowCaps(address[],uint256[])': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    if (decodedParams.length === 0 || decodedParams.some((param) => param === '')) {
      return 'No data provided for Borrow Caps.'
    }

    const addresses = decodedParams[0].split(',')
    const values = decodedParams[1].split(',')

    let finalText = 'Set MarketBorrowCaps for token(s):\n'

    for (let i = 0; i < addresses.length; i++) {
      const currentAddress = addresses[i]
      const currentValue = values[i]

      const { abi } = await getContractNameAndAbiFromFile(chain, currentAddress)
      const cTokenInstance = new Contract(currentAddress, abi, customProvider(chain))
      const { symbol } = await getContractSymbolAndDecimalsFromFile(currentAddress, cTokenInstance, chain)

      const symbolLink = addressFormatter(currentAddress, chain, symbol)

      // There is no underlying asset for the address
      if (currentAddress === '0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5') {
        finalText += `${tab}* Set MarketBorrowCaps of **${symbolLink}** to ${addCommas(defactorFn(currentValue))}`
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

      const thresholds = {
        warningThreshold: changeThresholds.V2.marketBorrowCapsWarningThreshold,
        criticalThreshold: changeThresholds.V2.marketBorrowCapsCriticalThreshold,
      }
      const sign = getCriticalitySign(changeInCaps, thresholds)

      const functionDesc = `${tab}* ${sign} Set MarketBorrowCaps of **${symbolLink}** via **${addressFormatter(transaction.target, chain, contractName)}**`
      const normalizedChanges = `Update from ${addCommas(prevValue)} to ${addCommas(newValue)} ${getChangeTextFn(changeInCaps)}`
      const rawChanges = `Update from ${borrowCaps} to ${currentValue}`

      finalText += `${functionDesc}.\n\n${tab}${tab}**Changes:** ${normalizedChanges}\n\n${tab}${tab}**Raw Changes:** ${rawChanges}`

      if (i < addresses.length - 1) {
        finalText += '\n'
      }
    }

    return finalText
  },
  '_setPriceOracle(address)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const targetAddress = transaction.target
    const { abi } = await getContractNameAndAbiFromFile(chain, targetAddress)
    const targetInstance = new Contract(targetAddress, abi, customProvider(chain))

    const prevValue = await targetInstance.callStatic.oracle()
    const newValue = decodedParams[0]

    return `⚠️ Set new price oracle to **${addressFormatter(newValue, chain)}**. Previous oracle was **${addressFormatter(prevValue, chain)}**.`
  },
  '_setMintPaused(address,bool)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const coinLink = await getFormattedTokenNameWithLink(chain, decodedParams[0])
    const contractNameWithLink = await getContractNameWithLink(transaction.target, chain)

    const change = getCurrentChange(decodedParams[1])
    return `⚠️ ${change} minting for ${coinLink} via ${contractNameWithLink}.`
  },
  '_setBorrowPaused(address,bool)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const coinLink = await getFormattedTokenNameWithLink(chain, decodedParams[0])
    const contractNameWithLink = await getContractNameWithLink(transaction.target, chain)

    const change = getCurrentChange(decodedParams[1])

    return `⚠️ ${change} ${coinLink} borrowing via ${contractNameWithLink}.`
  },
  '_setSeizePaused(bool)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const contractNameWithLink = await getContractNameWithLink(transaction.target, chain)

    const change = getCurrentChange(decodedParams[0])

    return `⚠️ ${change} market liquidation via ${contractNameWithLink}.`
  },
  '_setContributorCompSpeed(address,uint256)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const { abi, contractName } = await getContractNameAndAbiFromFile(chain, transaction.target)

    const targetInstance = new Contract(transaction.target, abi, customProvider(chain))

    const prevValueRaw = (await targetInstance.callStatic.compContributorSpeeds(decodedParams[0])).toString()
    const prevValue = defactorFn(prevValueRaw)
    const newValueRaw = decodedParams[1]
    const newValue = defactorFn(newValueRaw)

    const changeInSpeed = subtractFn(newValue, prevValue)
    const targetContractNameWithLink = addressFormatter(transaction.target, chain, contractName)

    const functionDesc = `Set ContributorCompSpeed for **${addressFormatter(decodedParams[0], chain)}** via **${targetContractNameWithLink}**`
    const normalizedChanges = `Update from ${addCommas(prevValue)} to ${addCommas(newValue)} ${getChangeTextFn(changeInSpeed)}`
    const rawChanges = `Update from ${prevValueRaw} to ${newValueRaw}`

    return `${functionDesc}\n\n${tab}  **Changes:** ${normalizedChanges}\n\n${tab}  **Raw Changes:** ${rawChanges}`
  },
  '_supportMarket(address)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const marketLink = await getFormattedTokenNameWithLink(chain, decodedParams[0])

    return `Support ${marketLink} on Compound.`
  },
  '_setPauseGuardian(address)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const contractNameWithLink = await getContractNameWithLink(transaction.target, chain)

    return `🛑 Set the Pause Guardian to ${await getRecipientNameWithLink(chain, decodedParams[0])} via ${contractNameWithLink}.`
  },
  '_become(address)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const targetAddress = addressFormatter(transaction.target, chain)
    const newImplementationAddress = addressFormatter(decodedParams[0], chain)

    return `🛑 Upgrade of the Compound Comptroller contract to a new implementation **${newImplementationAddress}** from **${targetAddress}**.`
  },
  'fixBadAccruals(address[],uint256[])': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = getPlatform(chain)
    const addressesList = decodedParams[0].split(',')
    const amountsList = decodedParams[1].split(',')

    return `🛑 Fix over-accrued COMP tokens of the addresses by their respective amounts:\n\n${formatAddressesAndAmounts(addressesList, amountsList, platform)}`
  },
}

function getCurrentChange(change: string) {
  return change === 'true' ? 'Pause' : 'Resume'
}
