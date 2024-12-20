import { BigNumber, Contract } from 'ethers'
import { customProvider } from '../../../utils/clients/ethers'
import { changeThresholds } from '../change-threshold'
import { annualizeFn, dailyRateFn, defactorFn, percentageFn, subtractFn } from './../../../utils/roundingUtils'
import { getContractNameAndAbiFromFile } from './../abi-utils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from './../compound-types'
import {
  addCommas,
  addressFormatter,
  fetchAssertIdFromCoinGeckoForSymbol,
  fetchDataForAsset,
  getChangeTextFn,
  getContractNameWithLink,
  getContractSymbolAndDecimalsFromFile,
  getAttentionSign,
  getFormattedTokenNameWithLink,
  getIcon,
  getPlatformFromGecko,
  getRecipientNameWithLink,
  IconType,
  tab,
  getCriticalitySign,
} from './helper'

interface AssetConfig {
  asset: string
  assetAddress: string
  priceFeed: string
  priceFeedAddress: string
  decimals: string
  borrowCollateralFactor: string
  borrowCollateralFactorRaw: string
  liquidateCollateralFactor: string
  liquidateCollateralFactorRaw: string
  liquidationFactor: string
  liquidationFactorRaw: string
  supplyCap: string
  supplyCapRaw: string
}

async function getTextForChangeInInterestRate(
  chain: CometChains,
  transaction: ExecuteTransactionInfo,
  decodedParams: string[],
  getInterestRateFunction: (contract: Contract) => Promise<BigNumber>,
  interestRateName: string,
  thresholds: { warningThreshold: number; criticalThreshold: number }
) {
  const { abi } = await getContractNameAndAbiFromFile(chain, decodedParams[0])
  const currentCometInstance = new Contract(decodedParams[0], abi, customProvider(chain))

  const previousRateInPercent = annualizeFn((await getInterestRateFunction(currentCometInstance)).toString())
  const currentRateInPercent = defactorFn(decodedParams[1])

  const changeInRate = subtractFn(currentRateInPercent, previousRateInPercent)
  const sign = getAttentionSign(changeInRate, thresholds)

  const functionDesc = await functionDescription({
    sign: sign,
    chain,
    functionName: interestRateName,
    targetAddress: transaction.target,
    cometAddress: decodedParams[0],
  })
  const normalizedChanges = `Update from ${addCommas(previousRateInPercent)} to ${addCommas(currentRateInPercent)} ${getChangeTextFn(changeInRate, false, thresholds)}`
  const details = `${functionDesc}\n\n${tab}  **Changes:** ${normalizedChanges}\n\n${tab}  **Raw Changes:** New value is ${decodedParams[1]}`
  const summary = `${sign} ${changeInRate.startsWith('-') ? 'Decrease' : 'Increase'} ${interestRateName} by ${addCommas(changeInRate)} ${getCriticalitySign(changeInRate, thresholds)} of ${await getMarket({chain, cometAddress:decodedParams[0]})} market (value=${addCommas(currentRateInPercent)}).`
  
  return { summary, details }
}

async function getTextForKinkChange(
  chain: CometChains,
  transaction: ExecuteTransactionInfo,
  decodedParams: string[],
  getPreviousValue: (contract: Contract) => Promise<BigNumber>,
  functionName: string,
  thresholds: { warningThreshold: number; criticalThreshold: number }
) {
  const { abi } = await getContractNameAndAbiFromFile(chain, decodedParams[0])
  const currentCometInstance = new Contract(decodedParams[0], abi, customProvider(chain))

  const prevValueRaw = (await getPreviousValue(currentCometInstance)).toString()
  const prevValue = defactorFn(prevValueRaw)
  const newValueRaw = decodedParams[1]
  const newValue = defactorFn(decodedParams[1])

  const changeInValues = subtractFn(newValue, prevValue)

  const sign = getAttentionSign(changeInValues, thresholds)

  const functionDesc = await functionDescription({
    sign: sign,
    chain,
    functionName: functionName,
    targetAddress: transaction.target,
    cometAddress: decodedParams[0],
  })

  const normalizedChange = `Update from ${prevValue} to ${newValue} ${getChangeTextFn(changeInValues, false, thresholds)}`
  const rawChange = `New value is ${newValueRaw}`
  const details = `${functionDesc}\n\n${tab}  **Changes:** ${normalizedChange}\n\n${tab}  **Raw Changes:** ${rawChange}`
  const summary = `${sign} ${changeInValues.startsWith('-') ? 'Decrease' : 'Increase'} ${functionName} by ${addCommas(changeInValues)} ${getCriticalitySign(changeInValues, thresholds)} of ${await getMarket({chain, cometAddress:decodedParams[0]})} market (value=${newValue}).`

  return { summary, details }
}

async function getTextForSpeedChange(
  chain: CometChains,
  transaction: ExecuteTransactionInfo,
  decodedParams: string[],
  getPreviousValue: (contract: Contract) => Promise<BigNumber>,
  functionName: string,
  speedName: string,
  thresholds: { warningThreshold: number; criticalThreshold: number }
) {
  const { abi } = await getContractNameAndAbiFromFile(chain, decodedParams[0])
  const currentCometInstance = new Contract(decodedParams[0], abi, customProvider(chain))

  const prevSpeedValue = (await getPreviousValue(currentCometInstance)).toString()
  const newSpeedValue = decodedParams[1]
  const changeInSpeedValues = subtractFn(newSpeedValue, prevSpeedValue)

  const prevRewardValue = dailyRateFn(defactorFn(prevSpeedValue, '15'))
  const newRewardValue = dailyRateFn(defactorFn(newSpeedValue, '15'))
  const changeInRewardValues = subtractFn(newRewardValue, prevRewardValue)

  const sign = getAttentionSign(changeInRewardValues, thresholds)

  const functionDesc = await functionDescription({
    sign,
    chain,
    functionName: functionName,
    targetAddress: transaction.target,
    cometAddress: decodedParams[0],
  })

  const normalizedChange = `Update from ${addCommas(prevSpeedValue)} to ${addCommas(newSpeedValue)} ${getChangeTextFn(
    changeInSpeedValues,
    false,
    thresholds
  )}. Hence changing Daily ${speedName} rewards from ${addCommas(prevRewardValue)} to ${addCommas(newRewardValue)} ${getChangeTextFn(changeInRewardValues)}`
  const rawChanges = `New value is ${newSpeedValue}`
  const details = `${functionDesc}\n\n${tab} **Changes:** ${normalizedChange}\n\n${tab}  **Raw Changes:** ${rawChanges}`
  const summary = `${sign} ${changeInSpeedValues.startsWith('-') ? 'Decrease' : 'Increase'} ${functionName} by ${addCommas(changeInSpeedValues)} ${getCriticalitySign(changeInSpeedValues, thresholds)} of ${await getMarket({chain, cometAddress:decodedParams[0]})} market (value=${addCommas(newSpeedValue)}).`
  
  return { summary, details }
}

async function getTextForFactorChange(
  chain: CometChains,
  transaction: ExecuteTransactionInfo,
  decodedParams: string[],
  functionName: string,
  thresholds: { warningThreshold: number; criticalThreshold: number },
  usePercentageConversion: boolean = true
) {
  const { abi } = await getContractNameAndAbiFromFile(chain, decodedParams[1])
  const tokenInstance = new Contract(decodedParams[1], abi, customProvider(chain))
  const { symbol: tokenSymbol, decimals } = await getContractSymbolAndDecimalsFromFile(decodedParams[1], tokenInstance, chain)

  const { abi: baseAbi } = await getContractNameAndAbiFromFile(chain, decodedParams[0])
  const currentBaseTokenInstance = new Contract(decodedParams[0], baseAbi, customProvider(chain))

  const assetInfo = await currentBaseTokenInstance.callStatic.getAssetInfoByAddress(decodedParams[1])
  const assetInfoPropertyName = functionName.charAt(0).toLowerCase() + functionName.slice(1)
  const factorRaw = assetInfo[assetInfoPropertyName].toString()
  const newFactorRaw = decodedParams[2]

  const prevFactor = usePercentageConversion ? percentageFn(defactorFn(factorRaw)) : defactorFn(factorRaw, decimals)
  const newFactor = usePercentageConversion ? percentageFn(defactorFn(newFactorRaw)) : defactorFn(newFactorRaw, decimals)

  const changeInFactor = subtractFn(newFactor, prevFactor)
  const sign = getAttentionSign(changeInFactor, thresholds)

  const tokenInfo = `**${addressFormatter(decodedParams[1], chain, tokenSymbol)}**`

  const functionDesc = await functionDescription({
    sign,
    chain,
    functionName: functionName,
    targetAddress: transaction.target,
    cometAddress: decodedParams[0],
  })
  const percentageSuffix = usePercentageConversion ? '%' : ''
  const functionDescWithToken = `${functionDesc} for token - ${tokenInfo}`
  const normalizedChanges = `Update from ${prevFactor}${percentageSuffix} to ${newFactor}${percentageSuffix} ${getChangeTextFn(
    changeInFactor,
    usePercentageConversion,
    thresholds
  )}`
  const rawChanges = `Update from ${factorRaw} to ${newFactorRaw} for token - ${decodedParams[1]}`
  const details = `${functionDescWithToken}\n\n${tab} **Changes:** ${normalizedChanges}\n\n${tab}  **Raw Changes:** ${rawChanges}`
  const summary = `${sign} ${changeInFactor.startsWith('-') ? 'Decrease' : 'Increase'} ${functionName} by ${addCommas(changeInFactor)} ${getCriticalitySign(changeInFactor, thresholds)} for ${tokenInfo} of ${await getMarket({chain, cometAddress:decodedParams[0]})} market (value=${newFactor}${percentageSuffix}).`
  return { summary, details }
}

export const configuratorFormatters: { [functionName: string]: TransactionFormatter } = {
  'setBorrowPerYearInterestRateBase(address,uint64)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const thresholds = {
      warningThreshold: changeThresholds.V3.borrowPerYearInterestRateBaseWarningThreshold,
      criticalThreshold: changeThresholds.V3.borrowPerYearInterestRateBaseCriticalThreshold,
    }
    return getTextForChangeInInterestRate(
      chain,
      transaction,
      decodedParams,
      async (contract) => await contract.callStatic.borrowPerSecondInterestRateBase(),
      'BorrowPerYearInterestRateBase',
      thresholds
    )
  },
  'setBorrowPerYearInterestRateSlopeLow(address,uint64)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const thresholds = {
      warningThreshold: changeThresholds.V3.borrowPerYearInterestRateSlopeLowWarningThreshold,
      criticalThreshold: changeThresholds.V3.borrowPerYearInterestRateSlopeLowCriticalThreshold,
    }
    return getTextForChangeInInterestRate(
      chain,
      transaction,
      decodedParams,
      async (contract) => await contract.callStatic.borrowPerSecondInterestRateSlopeLow(),
      'BorrowPerYearInterestRateSlopeLow',
      thresholds
    )
  },
  'setBorrowPerYearInterestRateSlopeHigh(address,uint64)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const thresholds = {
      warningThreshold: changeThresholds.V3.borrowPerYearInterestRateSlopeHighWarningThreshold,
      criticalThreshold: changeThresholds.V3.borrowPerYearInterestRateSlopeHighCriticalThreshold,
    }
    return getTextForChangeInInterestRate(
      chain,
      transaction,
      decodedParams,
      async (contract) => await contract.callStatic.borrowPerSecondInterestRateSlopeHigh(),
      'BorrowPerYearInterestRateSlopeHigh',
      thresholds
    )
  },
  'setSupplyPerYearInterestRateSlopeLow(address,uint64)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const thresholds = {
      warningThreshold: changeThresholds.V3.supplyPerYearInterestRateSlopeLowWarningThreshold,
      criticalThreshold: changeThresholds.V3.supplyPerYearInterestRateSlopeLowCriticalThreshold,
    }
    return getTextForChangeInInterestRate(
      chain,
      transaction,
      decodedParams,
      async (contract) => await contract.callStatic.supplyPerSecondInterestRateSlopeLow(),
      'SupplyPerYearInterestRateSlopeLow',
      thresholds
    )
  },
  'setSupplyPerYearInterestRateSlopeHigh(address,uint64)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const thresholds = {
      warningThreshold: changeThresholds.V3.supplyPerYearInterestRateSlopeHighWarningThreshold,
      criticalThreshold: changeThresholds.V3.supplyPerYearInterestRateSlopeHighCriticalThreshold,
    }
    return getTextForChangeInInterestRate(
      chain,
      transaction,
      decodedParams,
      async (contract) => await contract.callStatic.supplyPerSecondInterestRateSlopeHigh(),
      'SupplyPerYearInterestRateSlopeHigh',
      thresholds
    )
  },
  'setBaseTrackingBorrowSpeed(address,uint64)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const thresholds = {
      warningThreshold: changeThresholds.V3.baseTrackingBorrowSpeedWarningThreshold,
      criticalThreshold: changeThresholds.V3.baseTrackingBorrowSpeedCriticalThreshold,
    }
    return getTextForSpeedChange(
      chain,
      transaction,
      decodedParams,
      async (contract) => await contract.callStatic.baseTrackingBorrowSpeed(),
      'BaseTrackingBorrowSpeed',
      'Borrow',
      thresholds
    )
  },
  'setBaseTrackingSupplySpeed(address,uint64)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const thresholds = {
      warningThreshold: changeThresholds.V3.baseTrackingSupplySpeedWarningThreshold,
      criticalThreshold: changeThresholds.V3.baseTrackingSupplySpeedCriticalThreshold,
    }
    return getTextForSpeedChange(
      chain,
      transaction,
      decodedParams,
      async (contract) => await contract.callStatic.baseTrackingSupplySpeed(),
      'BaseTrackingSupplySpeed',
      'Supply',
      thresholds
    )
  },
  'setBorrowKink(address,uint64)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const thresholds = {
      warningThreshold: changeThresholds.V3.borrowKinkWarningThreshold,
      criticalThreshold: changeThresholds.V3.borrowKinkCriticalThreshold,
    }
    return getTextForKinkChange(chain, transaction, decodedParams, async (contract) => await contract.callStatic.borrowKink(), 'BorrowKink', thresholds)
  },
  'setSupplyKink(address,uint64)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const thresholds = {
      warningThreshold: changeThresholds.V3.supplyKinkWarningThreshold,
      criticalThreshold: changeThresholds.V3.supplyKinkCriticalThreshold,
    }
    return getTextForKinkChange(chain, transaction, decodedParams, async (contract) => await contract.callStatic.supplyKink(), 'SupplyKink', thresholds)
  },
  'updateAssetLiquidationFactor(address,address,uint64)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const thresholds = {
      warningThreshold: changeThresholds.V3.liquidationFactorWarningThreshold,
      criticalThreshold: changeThresholds.V3.liquidationFactorCriticalThreshold,
    }
    return getTextForFactorChange(chain, transaction, decodedParams, 'LiquidationFactor', thresholds)
  },
  'updateAssetBorrowCollateralFactor(address,address,uint64)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const thresholds = {
      warningThreshold: changeThresholds.V3.borrowCollateralFactorWarningThreshold,
      criticalThreshold: changeThresholds.V3.borrowCollateralFactorCriticalThreshold,
    }
    return getTextForFactorChange(chain, transaction, decodedParams, 'BorrowCollateralFactor', thresholds)
  },
  'updateAssetLiquidateCollateralFactor(address,address,uint64)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const thresholds = {
      warningThreshold: changeThresholds.V3.liquidationCollateralFactorWarningThreshold,
      criticalThreshold: changeThresholds.V3.liquidationCollateralFactorCriticalThreshold,
    }
    return getTextForFactorChange(chain, transaction, decodedParams, 'LiquidateCollateralFactor', thresholds)
  },
  'updateAssetSupplyCap(address,address,uint128)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const thresholds = {
      warningThreshold: changeThresholds.V3.supplyCapWarningThreshold,
      criticalThreshold: changeThresholds.V3.supplyCapCriticalThreshold,
    }
    return getTextForFactorChange(chain, transaction, decodedParams, 'SupplyCap', thresholds, false)
  },
  'setBaseBorrowMin(address,uint104)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const { abi } = await getContractNameAndAbiFromFile(chain, decodedParams[0])
    const currentInstance = new Contract(decodedParams[0], abi, customProvider(chain))

    const baseToken = await currentInstance.callStatic.baseToken()
    const { abi: baseTokenAbi } = await getContractNameAndAbiFromFile(chain, baseToken)
    const baseTokenInstance = new Contract(baseToken, baseTokenAbi, customProvider(chain))
    const { decimals } = await getContractSymbolAndDecimalsFromFile(baseToken, baseTokenInstance, chain)

    const baseBorrowMin = (await currentInstance.callStatic.baseBorrowMin()).toString()
    const prevBaseBorrowMin = defactorFn(baseBorrowMin, `${decimals}`)
    const newBaseValueRaw = decodedParams[1]
    const newBaseBorrowMin = defactorFn(newBaseValueRaw, `${decimals}`)

    const changeInBaseBorrowMin = subtractFn(newBaseBorrowMin, prevBaseBorrowMin)

    const thresholds = {
      warningThreshold: changeThresholds.V3.baseBorrowMinWarningThreshold,
      criticalThreshold: changeThresholds.V3.baseBorrowMinCriticalThreshold,
    }
    const sign = getAttentionSign(changeInBaseBorrowMin, thresholds)

    const functionDesc = await functionDescription({
      sign: sign,
      chain,
      functionName: 'BaseBorrowMin',
      targetAddress: transaction.target,
      cometAddress: decodedParams[0],
    })
    const normalizedChanges = `Update from ${addCommas(prevBaseBorrowMin)} to ${addCommas(newBaseBorrowMin)} ${getChangeTextFn(changeInBaseBorrowMin, false, thresholds)}`
    const details = `${functionDesc}\n\n${tab}  **Changes:** ${normalizedChanges}\n\n${tab}  **Raw Changes:** Update from ${baseBorrowMin} to ${newBaseValueRaw}`
    const summary = `${sign} ${changeInBaseBorrowMin.startsWith('-') ? 'Decrease' : 'Increase'} BaseBorrowMin by ${addCommas(changeInBaseBorrowMin)} ${getCriticalitySign(changeInBaseBorrowMin, thresholds)} of ${await getMarket({chain, cometAddress:decodedParams[0]})} market (value=${addCommas(newBaseBorrowMin)}).`
    
    return { summary, details }
  },
  'addAsset(address,tuple)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const [address, tuple] = decodedParams
    const tupleList = tuple.split(',')
    const assetAddress = tupleList[0]
    const { abi: contractAbi } = await getContractNameAndAbiFromFile(chain, address)
    const contractInstance = new Contract(address, contractAbi, customProvider(chain))

    const baseToken = await contractInstance.callStatic.baseToken()
    const { abi: baseTokenAbi } = await getContractNameAndAbiFromFile(chain, baseToken)
    const baseTokenInstance = new Contract(baseToken, baseTokenAbi, customProvider(chain))
    const { symbol } = await getContractSymbolAndDecimalsFromFile(baseToken, baseTokenInstance, chain)

    const { abi: assetAbi } = await getContractNameAndAbiFromFile(chain, assetAddress)
    const assetInstance = new Contract(tupleList[0], assetAbi, customProvider(chain))
    const { symbol: assetSymbol, decimals: assetDecimals } = await getContractSymbolAndDecimalsFromFile(tupleList[0], assetInstance, chain)

    const borrowCollateralFactorRaw = tupleList[3]
    const borrowCollateralFactor = defactorFn(borrowCollateralFactorRaw, `${assetDecimals}`)
    const liquidateCollateralFactorRaw = tupleList[4]
    const liquidateCollateralFactor = defactorFn(liquidateCollateralFactorRaw, `${assetDecimals}`)
    const liquidationFactorRaw = tupleList[5]
    const liquidationFactor = defactorFn(liquidationFactorRaw, `${assetDecimals}`)
    const supplyCapRaw = tupleList[6]
    const supplyCap = defactorFn(supplyCapRaw, `${assetDecimals}`)

    let assetTable = ''
    assetTable += `| Parameter | Value | Raw Value |\n`
    assetTable += `|-----------|-------|---------|\n`
    assetTable += `| Asset | ${addressFormatter(assetAddress, chain, assetSymbol)} | ${assetAddress} |\n`
    assetTable += `| PriceFeed | ${addressFormatter(tupleList[1], chain, 'PriceFeed')} | ${tupleList[1]} |\n`
    assetTable += `| Decimals | ${assetDecimals} | -- |\n`
    assetTable += `| BorrowCollateralFactor | ${percentageFn(borrowCollateralFactor)}% | ${borrowCollateralFactorRaw} |\n`
    assetTable += `| LiquidateCollateralFactor |  ${percentageFn(liquidateCollateralFactor)}% | ${liquidateCollateralFactorRaw} |\n`
    assetTable += `| LiquidationFactor | ${percentageFn(liquidationFactor)}% | ${liquidationFactorRaw} |\n`
    assetTable += `| SupplyCap | ${addCommas(supplyCap)} | ${supplyCapRaw} |\n\n`

    let geckoResponse = ''
    const assetID = await fetchAssertIdFromCoinGeckoForSymbol(assetSymbol)
    if (assetID) {
      const assetData = await fetchDataForAsset(assetID)
      const platform = getPlatformFromGecko(chain)
      const assetAddressOnGecko = assetData.platforms[`${platform}`]
      const marketCapRank = assetData.market_cap_rank
      const marketPriceUSD = assetData.market_data.current_price.usd
      const priceChangePercentage24h = assetData.market_data.price_change_percentage_24h
      const priceChange24hInUsd = assetData.market_data.market_cap_change_24h_in_currency.usd
      const assetTotalVolume = assetData.market_data.total_volume.usd
      const assetTotalSupply = assetData.market_data.total_supply

      const addressesVerificationString =
        assetAddressOnGecko?.toLowerCase() === assetAddress.toLowerCase()
          ? `${tab}* Asset address is verified ✅ on CoinGecko.\n`
          : `${tab}* Asset address is not verified ❌ on CoinGecko.\n`

      const marketCapRankString = `${tab}* Asset has Market cap rank of ${marketCapRank}\n`
      const currentPriceString = `${tab}* Current price is ${addCommas(marketPriceUSD)} USD\n`
      const priceChangeString = `${tab}* Price change in 24hrs is ${addCommas(priceChangePercentage24h)}%\n`
      const marketCapString = `${tab}* Market cap is ${addCommas(priceChange24hInUsd)} USD\n`
      const totalVolumeString = `${tab}* Total volume is ${addCommas(assetTotalVolume)} USD\n`
      const totalSupplyString = `${tab}* Total supply is ${addCommas(assetTotalSupply)}`
      geckoResponse += `${tab}**Asset Information from CoinGecko:**\n${addressesVerificationString}${marketCapRankString}${currentPriceString}${priceChangeString}${marketCapString}${totalVolumeString}${totalSupplyString}`
    }
    
    const icon = getIcon(IconType.Add)
    const details = `${icon} Add new asset to **${addressFormatter(
      baseToken,
      chain,
      symbol
    )}** market with following asset configuration:\n\n${tab}${assetTable}\n${geckoResponse}`
    const summary = `${icon} Add new asset ${addressFormatter(assetAddress, chain, assetSymbol)} to ${addressFormatter(baseToken,chain,symbol)} market.`
    
    return { summary, details }
  },
  'setFactory(address,address)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const { abi } = await getContractNameAndAbiFromFile(chain, decodedParams[0])
    const currentInstance = new Contract(decodedParams[0], abi, customProvider(chain))

    const baseToken = await currentInstance.callStatic.baseToken()
    const { abi: baseTokenAbi } = await getContractNameAndAbiFromFile(chain, baseToken)
    const baseTokenInstance = new Contract(baseToken, baseTokenAbi, customProvider(chain))
    const { symbol: tokenSymbol } = await getContractSymbolAndDecimalsFromFile(baseToken, baseTokenInstance, chain)

    const contractNameWithLink = await getContractNameWithLink(decodedParams[1], chain)

    const details = `${getIcon(IconType.Update)} Update the factory of **${addressFormatter(baseToken, chain, tokenSymbol)}** to ${contractNameWithLink}.`
    return { summary: details, details }
  },
  'setConfiguration(address,tuple)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const [address, tuple] = decodedParams
    const tupleList = tuple.split(',')

    const { abi: contractAbi } = await getContractNameAndAbiFromFile(chain, address)
    const contractInstance = new Contract(address, contractAbi, customProvider(chain))
    const contractBaseToken = await contractInstance.callStatic.baseToken()
    const { abi: contractBaseTokenAbi } = await getContractNameAndAbiFromFile(chain, contractBaseToken)
    const contractBaseTokenInstance = new Contract(contractBaseToken, contractBaseTokenAbi, customProvider(chain))
    const { symbol: contractBaseSymbol } = await getContractSymbolAndDecimalsFromFile(contractBaseToken, contractBaseTokenInstance, chain)
    const governorContractNameWithLink = await getContractNameWithLink(tupleList[0], chain)
    const { abi: baseTokenAbi } = await getContractNameAndAbiFromFile(chain, tupleList[2])
    const baseTokenInstance = new Contract(tupleList[2], baseTokenAbi, customProvider(chain))
    const { symbol: baseSymbol, decimals: baseDecimals } = await getContractSymbolAndDecimalsFromFile(tupleList[2], baseTokenInstance, chain)

    const supplyKink = defactorFn(tupleList[5])
    const supplyPerYearInterestRateSlopeLow = defactorFn(tupleList[6])
    const supplyPerYearInterestRateSlopeHigh = defactorFn(tupleList[7])
    const supplyPerYearInterestRateBase = defactorFn(tupleList[8])
    const borrowKink = defactorFn(tupleList[9])
    const borrowPerYearInterestRateSlopeLow = defactorFn(tupleList[10])
    const borrowPerYearInterestRateSlopeHigh = defactorFn(tupleList[11])
    const borrowPerYearInterestRateBase = defactorFn(tupleList[12])
    const storeFrontPriceFactor = defactorFn(tupleList[13])
    const trackingIndexScale = defactorFn(tupleList[14], `15`)
    const baseTrackingSupplySpeed = dailyRateFn(defactorFn(tupleList[15], `15`))
    const baseTrackingBorrowSpeed = dailyRateFn(defactorFn(tupleList[16], `15`))
    const baseMinForRewards = defactorFn(tupleList[17], `${baseDecimals}`)
    const baseBorrowMin = defactorFn(tupleList[18], `${baseDecimals}`)
    const targetReserves = defactorFn(tupleList[19], `${baseDecimals}`)

    const assetConfigs: AssetConfig[] = []

    for (let i = 20; i < tupleList.length; i += 7) {
      const { abi: assetAbi } = await getContractNameAndAbiFromFile(chain, tupleList[i])
      const assetInstance = new Contract(tupleList[i], assetAbi, customProvider(chain))
      const { symbol: assetSymbol } = await getContractSymbolAndDecimalsFromFile(tupleList[i], assetInstance, chain)
      const defactorValue = (index: number) => defactorFn(tupleList[i + index], `${tupleList[i + 2]}`)

      const assetConfigBlock: AssetConfig = {
        asset: `**${addressFormatter(tupleList[i], chain, assetSymbol)}**`,
        assetAddress: tupleList[i],
        priceFeed: `**${addressFormatter(tupleList[i + 1], chain, 'PriceFeed')}**`,
        priceFeedAddress: tupleList[i + 1],
        decimals: tupleList[i + 2],
        borrowCollateralFactor: percentageFn(defactorFn(tupleList[i + 3])) + `%`,
        borrowCollateralFactorRaw: tupleList[i + 3],
        liquidateCollateralFactor: percentageFn(defactorFn(tupleList[i + 4])) + `%`,
        liquidateCollateralFactorRaw: tupleList[i + 4],
        liquidationFactor: percentageFn(defactorFn(tupleList[i + 5])) + `%`,
        liquidationFactorRaw: tupleList[i + 5],
        supplyCap: addCommas(defactorValue(6)),
        supplyCapRaw: tupleList[i + 6],
      }

      assetConfigs.push(assetConfigBlock)
    }

    function generateAssetConfigTables(assetConfigs: AssetConfig[]) {
      let tablesString = ''
      assetConfigs.forEach((config) => {
        tablesString += `\n\n${tab}Asset Configuration for ${config.asset}:\n${tab}`
        tablesString += `| Parameter | Value | Raw Value |\n`
        tablesString += `|-----------|-------|--------| \n`
        tablesString += `| Asset | ${config.asset} | ${config.assetAddress} |\n`
        tablesString += `| PriceFeed | ${config.priceFeed} | ${config.priceFeedAddress} |\n`
        tablesString += `| Decimals | ${config.decimals} | - |\n`
        tablesString += `| BorrowCollateralFactor | ${config.borrowCollateralFactor} | ${config.borrowCollateralFactorRaw} |\n`
        tablesString += `| LiquidateCollateralFactor | ${config.liquidateCollateralFactor} | ${config.liquidateCollateralFactorRaw} | \n`
        tablesString += `| LiquidationFactor | ${config.liquidationFactor} | ${config.liquidationFactorRaw} | \n`
        tablesString += `| SupplyCap | ${config.supplyCap} | ${config.supplyCapRaw} |`
      })
      return tablesString
    }

    const assetConfigTables = generateAssetConfigTables(assetConfigs)

    let mainTable = `| Parameter | Value | Raw Value |\n`
    mainTable += `|-----------|-------|-------| \n`
    mainTable += `| Governor | [${governorContractNameWithLink} | ${tupleList[0]} |\n`
    mainTable += `| PauseGuardian | ${await getRecipientNameWithLink(chain, tupleList[1])} |${tupleList[1]} |\n`
    mainTable += `| BaseToken | **${addressFormatter(tupleList[2], chain, baseSymbol)}** |${tupleList[2]} |\n`
    mainTable += `| BaseToken PriceFeed | **${addressFormatter(tupleList[3], chain, 'PriceFeed')}** |${tupleList[3]} |\n`
    mainTable += `| ExtensionDelegate | ${await getRecipientNameWithLink(chain, tupleList[4])} |${tupleList[4]} |\n`
    mainTable += `| SupplyKink | ${percentageFn(supplyKink)}% |${tupleList[5]} |\n`
    mainTable += `| SupplyPerYearInterestRateSlopeLow | ${supplyPerYearInterestRateSlopeLow}% |${tupleList[6]} |\n`
    mainTable += `| SupplyPerYearInterestRateSlopeHigh | ${supplyPerYearInterestRateSlopeHigh}% |${tupleList[7]} |\n`
    mainTable += `| SupplyPerYearInterestRateBase | ${supplyPerYearInterestRateBase}% |${tupleList[8]} |\n`
    mainTable += `| BorrowKink | ${percentageFn(borrowKink)}% |${tupleList[9]} |\n`
    mainTable += `| BorrowPerYearInterestRateSlopeLow | ${borrowPerYearInterestRateSlopeLow}% |${tupleList[10]} |\n`
    mainTable += `| BorrowPerYearInterestRateSlopeHigh | ${borrowPerYearInterestRateSlopeHigh}% |${tupleList[11]} |\n`
    mainTable += `| BorrowPerYearInterestRateBase | ${borrowPerYearInterestRateBase}% |${tupleList[12]} |\n`
    mainTable += `| StoreFrontPriceFactor | ${percentageFn(storeFrontPriceFactor)}% |${tupleList[13]} |\n`
    mainTable += `| TrackingIndexScale | ${addCommas(trackingIndexScale)} |${tupleList[14]} |\n`
    mainTable += `| BaseTrackingSupplySpeed | ${addCommas(baseTrackingSupplySpeed)} |${tupleList[15]} |\n`
    mainTable += `| BaseTrackingBorrowSpeed | ${addCommas(baseTrackingBorrowSpeed)} |${tupleList[16]} |\n`
    mainTable += `| BaseMinForRewards | ${addCommas(baseMinForRewards)} |${tupleList[17]} |\n`
    mainTable += `| BaseBorrowMin | ${addCommas(baseBorrowMin)} |${tupleList[18]} |\n`
    mainTable += `| TargetReserves | ${addCommas(targetReserves)} |${tupleList[19]} |\n`

    const icon = getIcon(IconType.Update)
    const details = `${icon} Update the configuration for **${addressFormatter(
      contractBaseToken,
      chain,
      contractBaseSymbol
    )}** to: \n\n${tab}${mainTable}\n${tab}${assetConfigTables}`
    
    const assetList = assetConfigs.map((config) => config.asset).join(', ')
    const summary = `${icon} Update the configuration for ${addressFormatter(contractBaseToken, chain, contractBaseSymbol)} market and the asset(s) ${assetList}.`
    
    return { summary, details }
  },
  'setStoreFrontPriceFactor(address,uint64)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const { abi } = await getContractNameAndAbiFromFile(chain, decodedParams[0])
    const currentInstance = new Contract(decodedParams[0], abi, customProvider(chain))
    const baseToken = await currentInstance.callStatic.baseToken()

    const tokenNameWithLink = await getFormattedTokenNameWithLink(chain, baseToken)

    const storeFrontPriceFactor = (await currentInstance.callStatic.storeFrontPriceFactor()).toString()
    const priceFactorOld = percentageFn(defactorFn(storeFrontPriceFactor))
    const priceFactorNew = percentageFn(defactorFn(decodedParams[1]))

    const changeInFactor = subtractFn(priceFactorNew, priceFactorOld)

    const thresholds = {
      warningThreshold: changeThresholds.V3.storeFrontPriceFactorWarningThreshold,
      criticalThreshold: changeThresholds.V3.storeFrontPriceFactorCriticalThreshold,
    }
    const sign = getAttentionSign(changeInFactor, thresholds)
    const normalizedChanges = `Update from ${priceFactorOld}% to ${priceFactorNew}% ${getChangeTextFn(changeInFactor, true, thresholds)}`

    const details = `${sign} Update the StoreFrontPriceFactor for ${tokenNameWithLink}\n\n${tab}  **Changes:** ${normalizedChanges}\n\n${tab}  **Raw Changes:** new value - ${decodedParams[1]}`
    const summary = `${sign} ${changeInFactor.startsWith('-') ? 'Decrease' : 'Increase'} StoreFrontPriceFactor by ${addCommas(changeInFactor)} ${getCriticalitySign(changeInFactor, thresholds)} for ${tokenNameWithLink} market (value=${priceFactorNew}%).`
    
    return { summary, details }
  },
  'updateAssetPriceFeed(address,address,address)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const [cometProxy, asset, newPriceFeed] = decodedParams

    const { abi: contractAbi } = await getContractNameAndAbiFromFile(chain, cometProxy)
    const contractInstance = new Contract(cometProxy, contractAbi, customProvider(chain))
    const contractBaseToken = await contractInstance.callStatic.baseToken()

    const { abi: baseTokenAbi } = await getContractNameAndAbiFromFile(chain, contractBaseToken)
    const baseTokenInstance = new Contract(contractBaseToken, baseTokenAbi, customProvider(chain))
    const { symbol: contractBaseSymbol } = await getContractSymbolAndDecimalsFromFile(contractBaseToken, baseTokenInstance, chain)

    const { abi: tokenAbi } = await getContractNameAndAbiFromFile(chain, asset)
    const tokenInstance = new Contract(asset, tokenAbi, customProvider(chain))
    const { symbol: tokenSymbol } = await getContractSymbolAndDecimalsFromFile(asset, tokenInstance, chain)

    const details = `${getIcon(IconType.Update)} Update the price feed of **${addressFormatter(asset, chain, tokenSymbol)}** for **${addressFormatter(contractBaseToken, chain, contractBaseSymbol)}** market to ${addressFormatter(newPriceFeed, chain)}`
    return { summary: details, details }
  },
  'setMarketAdminPermissionChecker(address)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const contractNameWithLink = await getContractNameWithLink(transaction.target, chain)
    
    const details = `${getIcon(IconType.Update)} Update the MarketAdminPermissionChecker  of ${contractNameWithLink} to ${addressFormatter(decodedParams[0], chain)}.`
    return {summary: details, details}
  }
}

async function functionDescription({
  sign,
  chain,
  functionName,
  targetAddress,
  cometAddress,
}: {
  sign: string
  chain: CometChains
  functionName: string
  targetAddress: string
  cometAddress: string
}) {
  const { abi } = await getContractNameAndAbiFromFile(chain, cometAddress)
  const currentCometInstance = new Contract(cometAddress, abi, customProvider(chain))

  const baseTokenAddress = await currentCometInstance.callStatic.baseToken()
  const { abi: baseTokenAbi } = await getContractNameAndAbiFromFile(chain, baseTokenAddress)
  const baseTokenInstance = new Contract(baseTokenAddress, baseTokenAbi, customProvider(chain))
  const { symbol: marketSymbol } = await getContractSymbolAndDecimalsFromFile(baseTokenAddress, baseTokenInstance, chain)

  const targetContractNameWithLink = await getContractNameWithLink(targetAddress, chain)

  return `${sign} Update the ${functionName} of **${addressFormatter(baseTokenAddress, chain, marketSymbol)}** via ${targetContractNameWithLink}`
}

async function getMarket({
  chain,
  cometAddress,
}: {
  chain: CometChains
  cometAddress: string
}) {
  const { abi } = await getContractNameAndAbiFromFile(chain, cometAddress)
  const currentCometInstance = new Contract(cometAddress, abi, customProvider(chain))

  const baseTokenAddress = await currentCometInstance.callStatic.baseToken()
  const { abi: baseTokenAbi } = await getContractNameAndAbiFromFile(chain, baseTokenAddress)
  const baseTokenInstance = new Contract(baseTokenAddress, baseTokenAbi, customProvider(chain))
  const { symbol: marketSymbol } = await getContractSymbolAndDecimalsFromFile(baseTokenAddress, baseTokenInstance, chain)

  return `**${addressFormatter(baseTokenAddress, chain, marketSymbol)}**`
}