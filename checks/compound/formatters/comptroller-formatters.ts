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
  getAttentionSign,
  getFormattedTokenNameWithLink,
  getIcon,
  getPlatform,
  getRecipientNameWithLink,
  IconType,
  tab,
  getCriticalitySign,
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

    const details = `${getIcon(IconType.Money)} Grant **${addCommas(numberOfCompTokens)} ${addressFormatter(compAddress, chain, symbol)}** tokens to ${await getRecipientNameWithLink(
      chain,
      decodedParams[0]
    )}.`
    return { summary: details, details }
  },
  '_setCompSpeeds(address[],uint256[],uint256[])': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    if (decodedParams.length === 0 || decodedParams.some((param) => param === '')) {
      return 'No data provided for Comp speeds.'
    }
    const addresses = decodedParams[0].split(',')
    const supplySpeeds = decodedParams[1].split(',')
    const borrowSpeeds = decodedParams[2].split(',')

    let finalText = `${getIcon(IconType.Update)} Update the CompSpeeds for token(s):\n`
    const tokens: string[] = []
    
    for (let i = 0; i < addresses.length; i++) {
      const currentAddress = addresses[i]
      const currentBorrowSpeed = borrowSpeeds[i]
      const currentSupplySpeed = supplySpeeds[i]

      const symbol = await getFormattedTokenNameWithLink(chain, currentAddress)
      tokens.push(symbol)
      
      const { abi: targetAbi } = await getContractNameAndAbiFromFile(chain, transaction.target)
      const currentTargetInstance = new Contract(transaction.target, targetAbi, customProvider(chain))

      const compAddress = await currentTargetInstance.callStatic.getCompAddress()
      const compSymbol = await getFormattedTokenNameWithLink(chain, compAddress)

      const baseText = `Update the CompSpeeds for ${symbol}`

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

    const summary = `${getIcon(IconType.Update)} Update the CompSpeeds for the token(s): ${tokens.join(', ')}.`
    return { summary, details: finalText }
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
      const sign = getAttentionSign(changeInFactor, thresholds)
      const targetTokenLink = addressFormatter(targetToken, chain, symbol)
      const normalizedChanges = `Update from ${prevValuePercentage}% to ${newValuePercentage}% ${getChangeTextFn(changeInFactor, true, thresholds)}`
      const rawChanges = `Update from ${prevValueRaw} to ${newValueRaw}`

      const details = `${sign} Update the collateral factor for **${targetTokenLink}**\n\n${tab}  **Changes:** ${normalizedChanges}\n\n${tab}  **Raw Changes:** ${rawChanges}`
      const summary = `${sign} ${changeInFactor.startsWith('-') ? 'Decrease' : 'Increase'} CollateralFactor by ${addCommas(changeInFactor)} ${getCriticalitySign(changeInFactor, thresholds)} for **${targetTokenLink}** (value=${newValuePercentage}%).`
      
      return {summary, details}
    }
    
    const icon = getIcon(IconType.Update)
    const details = `${icon} Update the collateral factor for **${targetToken}**\n\n${tab}  **Changes:** ${newValuePercentage}%\n\n${tab}  **Raw Changes:** ${newValueRaw}`
    const summary = `${icon} Update the collateral factor for ${targetToken} to ${newValuePercentage}%`
    
    return {summary, details}
  },
  '_setMarketBorrowCaps(address[],uint256[])': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    if (decodedParams.length === 0 || decodedParams.some((param) => param === '')) {
      return 'No data provided for Borrow Caps.'
    }

    const addresses = decodedParams[0].split(',')
    const values = decodedParams[1].split(',')

    let finalText = `${getIcon(IconType.Update)} Update MarketBorrowCaps for token(s):\n`
    const tokens: string[] = []
    for (let i = 0; i < addresses.length; i++) {
      const currentAddress = addresses[i]
      const currentValue = values[i]

      const { abi } = await getContractNameAndAbiFromFile(chain, currentAddress)
      const cTokenInstance = new Contract(currentAddress, abi, customProvider(chain))
      const { symbol } = await getContractSymbolAndDecimalsFromFile(currentAddress, cTokenInstance, chain)

      const symbolLink = addressFormatter(currentAddress, chain, symbol)
      tokens.push(symbolLink)
      
      // There is no underlying asset for the address
      if (currentAddress === '0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5') {
        finalText += `${tab}* Update the MarketBorrowCap of **${symbolLink}** to ${addCommas(defactorFn(currentValue))}`
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
      const sign = getAttentionSign(changeInCaps, thresholds)

      const functionDesc = `${tab}* ${sign} Update the MarketBorrowCap of **${symbolLink}** via **${addressFormatter(transaction.target, chain, contractName)}**`
      const normalizedChanges = `Update from ${addCommas(prevValue)} to ${addCommas(newValue)} ${getChangeTextFn(changeInCaps, false, thresholds)}`
      const rawChanges = `Update from ${borrowCaps} to ${currentValue}`

      finalText += `${functionDesc}.\n\n${tab}${tab}**Changes:** ${normalizedChanges}\n\n${tab}${tab}**Raw Changes:** ${rawChanges}`

      if (i < addresses.length - 1) {
        finalText += '\n'
      }
    }
    const summary = `${getIcon(IconType.Update)} Update the MarketBorrowCap for the token(s): ${tokens.join(', ')}.`
    return { summary, details: finalText }
  },
  '_setPriceOracle(address)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const targetAddress = transaction.target
    const { abi } = await getContractNameAndAbiFromFile(chain, targetAddress)
    const targetInstance = new Contract(targetAddress, abi, customProvider(chain))

    const prevValue = await targetInstance.callStatic.oracle()
    const newValue = decodedParams[0]

    const details = `${getIcon(IconType.Update)} Update the price oracle to **${addressFormatter(newValue, chain)}**. Previous oracle was **${addressFormatter(prevValue, chain)}**.`
    return { summary: details, details }
  },
  '_setMintPaused(address,bool)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const coinLink = await getFormattedTokenNameWithLink(chain, decodedParams[0])
    const contractNameWithLink = await getContractNameWithLink(transaction.target, chain)

    const change = getCurrentChange(decodedParams[1])
    
    const details = `${change} minting for ${coinLink} via ${contractNameWithLink}.`
    return { summary: details, details }
  },
  '_setBorrowPaused(address,bool)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const coinLink = await getFormattedTokenNameWithLink(chain, decodedParams[0])
    const contractNameWithLink = await getContractNameWithLink(transaction.target, chain)

    const change = getCurrentChange(decodedParams[1])

    const details = `${change} ${coinLink} borrowing via ${contractNameWithLink}.`
    return { summary: details, details }
  },
  '_setSeizePaused(bool)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const contractNameWithLink = await getContractNameWithLink(transaction.target, chain)

    const change = getCurrentChange(decodedParams[0])

    const details = `${change} market liquidation via ${contractNameWithLink}.`
    return { summary: details, details }
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

    const functionDesc = `Update the ContributorCompSpeed for **${addressFormatter(decodedParams[0], chain)}** via **${targetContractNameWithLink}**`
    const normalizedChanges = `Update from ${addCommas(prevValue)} to ${addCommas(newValue)} ${getChangeTextFn(changeInSpeed)}`
    const rawChanges = `Update from ${prevValueRaw} to ${newValueRaw}`
    
    const icon = getIcon(IconType.Update)
    const details = `${icon} ${functionDesc}\n\n${tab}  **Changes:** ${normalizedChanges}\n\n${tab}  **Raw Changes:** ${rawChanges}`
    const summary = `${icon} ${changeInSpeed.startsWith('-') ? 'Decrease' : 'Increase'} ContributorCompSpeed by ${addCommas(changeInSpeed)} for ${addressFormatter(decodedParams[0], chain)} market (value=${addCommas(newValue)}).`
    
    return { summary, details }
  },
  '_supportMarket(address)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const marketLink = await getFormattedTokenNameWithLink(chain, decodedParams[0])

    const details = `${getIcon(IconType.Add)} Add ${marketLink} on Compound.`
    return { summary: details, details }
  },
  '_setPauseGuardian(address)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const contractNameWithLink = await getContractNameWithLink(transaction.target, chain)

    const details = `${getIcon(IconType.Update)} Update the Pause Guardian to ${await getRecipientNameWithLink(chain, decodedParams[0])} via ${contractNameWithLink}.`
    return { summary: details, details }
  },
  '_become(address)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const targetAddress = addressFormatter(transaction.target, chain)
    const newImplementationAddress = addressFormatter(decodedParams[0], chain)

    const details = `${getIcon(IconType.Update)} Update the implementation for Compound Comptroller from **${targetAddress}** to **${newImplementationAddress}**.`
    return { summary: details, details }
  },
  'fixBadAccruals(address[],uint256[])': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = getPlatform(chain)
    const addressesList = decodedParams[0].split(',')
    const amountsList = decodedParams[1].split(',')

    const icon = getIcon(IconType.Money)
    const details = `${icon} Fix over-accrued COMP tokens of the addresses by their respective amounts:\n\n${formatAddressesAndAmounts(addressesList, amountsList, platform)}`
    const summary = `${icon} Fix over-accrued COMP tokens of the addresses.`
    return { summary, details }
  },
}

function getCurrentChange(change: string) {
  return change === 'true' ? `${getIcon(IconType.Pause)} Pause` : `${getIcon(IconType.Unpause)} Resume`
}
