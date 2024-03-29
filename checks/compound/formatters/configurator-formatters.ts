import { BigNumber, Contract } from 'ethers'
import { customProvider } from '../../../utils/clients/ethers'
import { changeThresholds } from '../change-threshold'
import { annualizeFn, dailyRateFn, defactorFn, percentageFn, subtractFn } from './../../../utils/roundingUtils'
import { getContractNameAndAbiFromFile } from './../abi-utils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from './../compound-types'
import {
  addCommas,
  fetchAssertIdFromCoinGeckoForSymbol,
  fetchDataForAsset,
  getChangeTextFn,
  getContractSymbolAndDecimalsFromFile,
  getCriticalitySign,
  getFormattedTokenNameWithLink,
  getPlatform,
  getPlatformFromGecko,
  getRecipientNameWithLink,
  tab,
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

  const functionDesc = await functionDescription({
    sign: '',
    chain,
    functionName: interestRateName,
    targetAddress: transaction.target,
    cometAddress: decodedParams[0],
  })
  const normalizedChanges = `${addCommas(previousRateInPercent)} to ${addCommas(currentRateInPercent)} ${getChangeTextFn(changeInRate)}`
  return `${functionDesc}\n\n${tab}  Changes: ${normalizedChanges}\n\n${tab}  Raw Changes: new value - ${decodedParams[1]}`
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

  const prevValue = percentageFn(defactorFn((await getPreviousValue(currentCometInstance)).toString()))
  const newValue = percentageFn(defactorFn(decodedParams[1]))

  const changeInValues = subtractFn(newValue, prevValue)

  const sign = getCriticalitySign(changeInValues, thresholds)

  const functionDesc = await functionDescription({
    sign: sign,
    chain,
    functionName: functionName,
    targetAddress: transaction.target,
    cometAddress: decodedParams[0],
  })

  const normalizedChange = `Update from ${addCommas(prevValue)}% to ${addCommas(newValue)}% ${getChangeTextFn(changeInValues, true)}`
  const rawChange = `Update from ${prevValue} to ${newValue}`
  return `${functionDesc}\n\n${tab}  Changes: ${normalizedChange}\n\n${tab}  RawChanges: ${rawChange}`
}

async function getTextForSpeedChange(
  chain: CometChains,
  transaction: ExecuteTransactionInfo,
  decodedParams: string[],
  getPreviousValue: (contract: Contract) => Promise<BigNumber>,
  functionName: string,
  speedName: string,
  threshold: { warningThreshold: number; criticalThreshold: number }
) {
  const { abi } = await getContractNameAndAbiFromFile(chain, decodedParams[0])
  const currentCometInstance = new Contract(decodedParams[0], abi, customProvider(chain))

  const prevSpeedValue = (await getPreviousValue(currentCometInstance)).toString()
  const newSpeedValue = decodedParams[1]
  const changeInSpeedValues = subtractFn(newSpeedValue, prevSpeedValue)

  const prevRewardValue = dailyRateFn(defactorFn(prevSpeedValue, '15'))
  const newRewardValue = dailyRateFn(defactorFn(newSpeedValue, '15'))
  const changeInRewardValues = subtractFn(newRewardValue, prevRewardValue)

  const sign = getCriticalitySign(changeInRewardValues, threshold)

  const functionDesc = await functionDescription({
    sign: sign,
    chain,
    functionName: functionName,
    targetAddress: transaction.target,
    cometAddress: decodedParams[0],
  })

  const normalizedChange = `${addCommas(prevSpeedValue)} to ${addCommas(newSpeedValue)} ${getChangeTextFn(
    changeInSpeedValues
  )}. Hence changing Daily ${speedName} rewards from ${addCommas(prevRewardValue)} to ${addCommas(newRewardValue)} ${getChangeTextFn(changeInRewardValues)}`
  const rawChanges = `Update from ${prevSpeedValue} to ${newSpeedValue}`
  return `${functionDesc}\n\n${tab} Changes: ${normalizedChange}\n\n${tab}  Raw Changes: ${rawChanges}`
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
    const platform = getPlatform(chain)

    const { abi } = await getContractNameAndAbiFromFile(chain, decodedParams[1])
    const tokenInstance = new Contract(decodedParams[1], abi, customProvider(chain))
    const { symbol: tokenSymbol } = await getContractSymbolAndDecimalsFromFile(decodedParams[1], tokenInstance, chain)

    const { abi: baseAbi } = await getContractNameAndAbiFromFile(chain, decodedParams[0])
    const currentBaseTokenInstance = new Contract(decodedParams[0], baseAbi, customProvider(chain))

    const assetInfo = await currentBaseTokenInstance.callStatic.getAssetInfoByAddress(decodedParams[1])

    const prevLiquidationFactorRaw = assetInfo.liquidationFactor.toString()
    const newLiquidationFactorRaw = decodedParams[2]

    const prevLiquidationFactor = percentageFn(defactorFn(prevLiquidationFactorRaw))
    const newLiquidationFactor = percentageFn(defactorFn(newLiquidationFactorRaw))

    const changeInLiquidationFactor = subtractFn(newLiquidationFactor, prevLiquidationFactor)

    const thresholds = {
      warningThreshold: changeThresholds.V3.liquidationFactorWarningThreshold,
      criticalThreshold: changeThresholds.V3.liquidationFactorCriticalThreshold,
    }
    const sign = getCriticalitySign(changeInLiquidationFactor, thresholds)

    const tokenInfo = `**[${tokenSymbol}](https://${platform}/address/${decodedParams[1]})**`

    const functionDesc = await functionDescription({
      sign: sign,
      chain,
      functionName: 'LiquidationFactor',
      targetAddress: transaction.target,
      cometAddress: decodedParams[0],
    })

    const functionDescWithToken = `${functionDesc} for token - ${tokenInfo}`
    const normalizedChanges = `Update from ${prevLiquidationFactor}% to ${newLiquidationFactor}% ${getChangeTextFn(changeInLiquidationFactor, true)}`
    const rawChanges = `Update from ${prevLiquidationFactorRaw} to ${newLiquidationFactorRaw} for token - ${decodedParams[1]}`
    return `${functionDescWithToken}\n\n${tab} Changes: ${normalizedChanges}\n\n${tab}  Raw Changes: ${rawChanges}`
  },
  'updateAssetSupplyCap(address,address,uint128)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = getPlatform(chain)

    const tokenAddress = decodedParams[1]
    const { abi } = await getContractNameAndAbiFromFile(chain, tokenAddress)
    const tokenInstance = new Contract(tokenAddress, abi, customProvider(chain))
    const { symbol: tokenSymbol, decimals } = await getContractSymbolAndDecimalsFromFile(tokenAddress, tokenInstance, chain)

    const { abi: baseAbi } = await getContractNameAndAbiFromFile(chain, decodedParams[0])
    const currentBaseTokenInstance = new Contract(decodedParams[0], baseAbi, customProvider(chain))
    const assetInfo = await currentBaseTokenInstance.callStatic.getAssetInfoByAddress(tokenAddress)

    const previousSupplyCapRaw = assetInfo.supplyCap.toString()
    const prevSupplyCap = defactorFn(previousSupplyCapRaw, `${decimals}`)

    const newSupplyCapRaw = decodedParams[2]
    const newSupplyCap = defactorFn(newSupplyCapRaw, `${decimals}`)

    const changeInSupplyCap = subtractFn(newSupplyCap, prevSupplyCap)

    const thresholds = {
      warningThreshold: changeThresholds.V3.supplyCapWarningThreshold,
      criticalThreshold: changeThresholds.V3.supplyCapCriticalThreshold,
    }
    const sign = getCriticalitySign(changeInSupplyCap, thresholds)

    const tokenInfo = `**[${tokenSymbol}](https://${platform}/address/${tokenAddress})**`

    const functionDesc = await functionDescription({
      sign: sign,
      chain,
      functionName: 'SupplyCap',
      targetAddress: transaction.target,
      cometAddress: decodedParams[0],
    })

    const functionDescWithToken = `${functionDesc} for token - ${tokenInfo}`

    const normalizedChanges = `Update from ${addCommas(prevSupplyCap)} to ${addCommas(newSupplyCap)} ${getChangeTextFn(changeInSupplyCap)}`
    const rawChanges = `Update from ${previousSupplyCapRaw} to ${newSupplyCapRaw} for token - ${tokenAddress}`
    return `${functionDescWithToken}\n\n${tab}  Changes: ${normalizedChanges}\n\n${tab}  Raw Changes: ${rawChanges}`
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
    const sign = getCriticalitySign(changeInBaseBorrowMin, thresholds)

    const functionDesc = await functionDescription({
      sign: sign,
      chain,
      functionName: 'BaseBorrowMin',
      targetAddress: transaction.target,
      cometAddress: decodedParams[0],
    })
    const normalizedChanges = `Update from ${addCommas(prevBaseBorrowMin)} to ${addCommas(newBaseBorrowMin)} ${getChangeTextFn(changeInBaseBorrowMin)}`
    return `${functionDesc}\n\n${tab}  Changes: ${normalizedChanges}\n\n${tab}  Raw Changes: Update from ${baseBorrowMin} to ${newBaseValueRaw}`
  },
  'addAsset(address,tuple)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = getPlatform(chain)

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
    assetTable += `| Asset | [${assetSymbol}](https://${platform}/address/${assetAddress}) | ${assetAddress} |\n`
    assetTable += `| PriceFeed | [PriceFeed](https://${platform}/address/${tupleList[1]}) | ${tupleList[1]} |\n`
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
        assetAddressOnGecko.toLowerCase() === assetAddress.toLowerCase()
          ? `${tab}* 🟢 Asset address is verified on CoinGecko.\n`
          : `${tab}* 🔴 Asset address is not verified on CoinGecko.\n`

      const marketCapRankString = `${tab}* Asset has Market cap rank of ${marketCapRank}\n`
      const currentPriceString = `${tab}* Current price is ${addCommas(marketPriceUSD)} USD\n`
      const priceChangeString = `${tab}* Price change in 24hrs is ${addCommas(priceChangePercentage24h)}%\n`
      const marketCapString = `${tab}* Market cap is ${addCommas(priceChange24hInUsd)} USD\n`
      const totalVolumeString = `${tab}* Total volume is ${addCommas(assetTotalVolume)} USD\n`
      const totalSupplyString = `${tab}* Total supply is ${addCommas(assetTotalSupply)}`
      geckoResponse += `${tab}**Asset Information from CoinGecko:**\n${addressesVerificationString}${marketCapRankString}${currentPriceString}${priceChangeString}${marketCapString}${totalVolumeString}${totalSupplyString}`
    }
    return `🛑 Add new asset to market **[${symbol}](https://${platform}/address/${baseToken})** with following asset configuration:\n\n${tab}${assetTable}\n${geckoResponse}`
  },
  'setFactory(address,address)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = getPlatform(chain)

    const { abi } = await getContractNameAndAbiFromFile(chain, decodedParams[0])
    const currentInstance = new Contract(decodedParams[0], abi, customProvider(chain))

    const baseToken = await currentInstance.callStatic.baseToken()
    const { abi: baseTokenAbi } = await getContractNameAndAbiFromFile(chain, baseToken)
    const baseTokenInstance = new Contract(baseToken, baseTokenAbi, customProvider(chain))
    const { symbol: tokenSymbol } = await getContractSymbolAndDecimalsFromFile(baseToken, baseTokenInstance, chain)

    const { contractName } = await getContractNameAndAbiFromFile(chain, decodedParams[1])

    return `🛑 Set factory of **[${tokenSymbol}](https://${platform}/address/${baseToken})** to **[${contractName}](https://${platform}/address/${decodedParams[1]})**.`
  },
  'setConfiguration(address,tuple)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = getPlatform(chain)

    const [address, tuple] = decodedParams
    const tupleList = tuple.split(',')

    const { abi: contractAbi } = await getContractNameAndAbiFromFile(chain, address)
    const contractInstance = new Contract(address, contractAbi, customProvider(chain))
    const contractBaseToken = await contractInstance.callStatic.baseToken()
    const { abi: contractBaseTokenAbi } = await getContractNameAndAbiFromFile(chain, contractBaseToken)
    const contractBaseTokenInstance = new Contract(contractBaseToken, contractBaseTokenAbi, customProvider(chain))
    const { symbol: contractBaseSymbol } = await getContractSymbolAndDecimalsFromFile(contractBaseToken, contractBaseTokenInstance, chain)
    const { contractName: governor } = await getContractNameAndAbiFromFile(chain, tupleList[0])

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
        asset: `**[${assetSymbol}](https://${platform}/address/${tupleList[i]})**`,
        assetAddress: tupleList[i],
        priceFeed: `**[PriceFeed](https://${platform}/address/${tupleList[i + 1]})**`,
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
    mainTable += `| Governor | **[${governor}](https://${platform}/address/${tupleList[0]})** | ${tupleList[0]} |\n`
    mainTable += `| PauseGuardian | ${await getRecipientNameWithLink(chain, tupleList[1])} |${tupleList[1]} |\n`
    mainTable += `| BaseToken | **[${baseSymbol}](https://${platform}/address/${tupleList[2]})** |${tupleList[2]} |\n`
    mainTable += `| BaseToken PriceFeed | **[PriceFeed](https://${platform}/address/${tupleList[3]})** |${tupleList[3]} |\n`
    mainTable += `| ExtensionDelegate | ${await getRecipientNameWithLink(chain, tupleList[4])} |${tupleList[4]} |\n`
    mainTable += `| SupplyKink | ${percentageFn(supplyKink)}% |${tupleList[5]} |\n`
    mainTable += `| SupplyPerYearInterestRateSlopeLow | ${percentageFn(supplyPerYearInterestRateSlopeLow)}% |${tupleList[6]} |\n`
    mainTable += `| SupplyPerYearInterestRateSlopeHigh | ${percentageFn(supplyPerYearInterestRateSlopeHigh)}% |${tupleList[7]} |\n`
    mainTable += `| SupplyPerYearInterestRateBase | ${percentageFn(supplyPerYearInterestRateBase)}% |${tupleList[8]} |\n`
    mainTable += `| BorrowKink | ${percentageFn(borrowKink)}% |${tupleList[9]} |\n`
    mainTable += `| BorrowPerYearInterestRateSlopeLow | ${percentageFn(borrowPerYearInterestRateSlopeLow)}% |${tupleList[10]} |\n`
    mainTable += `| BorrowPerYearInterestRateSlopeHigh | ${percentageFn(borrowPerYearInterestRateSlopeHigh)}% |${tupleList[11]} |\n`
    mainTable += `| BorrowPerYearInterestRateBase | ${percentageFn(borrowPerYearInterestRateBase)}% |${tupleList[12]} |\n`
    mainTable += `| StoreFrontPriceFactor | ${percentageFn(storeFrontPriceFactor)}% |${tupleList[13]} |\n`
    mainTable += `| TrackingIndexScale | ${addCommas(trackingIndexScale)} |${tupleList[14]} |\n`
    mainTable += `| BaseTrackingSupplySpeed | ${addCommas(baseTrackingSupplySpeed)} |${tupleList[15]} |\n`
    mainTable += `| BaseTrackingBorrowSpeed | ${addCommas(baseTrackingBorrowSpeed)} |${tupleList[16]} |\n`
    mainTable += `| BaseMinForRewards | ${addCommas(baseMinForRewards)} |${tupleList[17]} |\n`
    mainTable += `| BaseBorrowMin | ${addCommas(baseBorrowMin)} |${tupleList[18]} |\n`
    mainTable += `| TargetReserves | ${addCommas(targetReserves)} |${tupleList[19]} |\n`

    return `⚠️ Set configuration for **[${contractBaseSymbol}](https://${platform}/address/${contractBaseToken})** to: \n\n${tab}${mainTable}\n${tab}${assetConfigTables}`
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
    const sign = getCriticalitySign(changeInFactor, thresholds)

    return `${sign} Set StoreFrontPriceFactor for ${tokenNameWithLink} from ${priceFactorOld}% to ${priceFactorNew}% ${getChangeTextFn(changeInFactor, true)}`
  },
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

  const platform = getPlatform(chain)
  const baseTokenAddress = await currentCometInstance.callStatic.baseToken()
  const { abi: baseTokenAbi } = await getContractNameAndAbiFromFile(chain, baseTokenAddress)
  const baseTokenInstance = new Contract(baseTokenAddress, baseTokenAbi, customProvider(chain))
  const { symbol: marketSymbol } = await getContractSymbolAndDecimalsFromFile(baseTokenAddress, baseTokenInstance, chain)

  const { contractName: targetName } = await getContractNameAndAbiFromFile(chain, targetAddress)

  return `${sign} Set ${functionName} of **[${marketSymbol}](https://${platform}/address/${baseTokenAddress})** via **[${targetName}](https://${platform}/address/${targetAddress}})**`
}
