import { BigNumber, Contract } from 'ethers'
import { customProvider } from '../../../utils/clients/ethers'
import { getContractNameAndAbiFromFile } from './../abi-utils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from './../compound-types'
import {
  getPlatform,
  getContractSymbolAndDecimalsFromFile,
  getFormattedTokenNameWithLink,
  getCriticalitySign,
  fetchAssertIdFromCoinGeckoForSymbol,
  fetchDataForAsset,
  getPlatformFromGecko,
  addCommas,
  getChangeTextFn,
  getRecipientNameWithLink,
  tab,
} from './helper'
import { annualizeFn, dailyRateFn, defactorFn, percentageFn, subtractFn } from './../../../utils/roundingUtils'

interface AssetConfig {
  asset: string
  priceFeed: string
  decimals: string
  borrowCollateralFactor: string
  liquidateCollateralFactor: string
  liquidationFactor: string
  supplyCap: string
}

async function getTextForChangeInInterestRate(
  chain: CometChains,
  decodedParams: string[],
  getInterestRateFunction: (contract: Contract) => Promise<BigNumber>,
  interestRateName: string,
  platform: string
) {
  const { abi } = await getContractNameAndAbiFromFile(chain, decodedParams[0])
  const currentCometInstance = new Contract(decodedParams[0], abi, customProvider(chain))

  const baseToken = await currentCometInstance.callStatic.baseToken()
  const { abi: baseTokenAbi } = await getContractNameAndAbiFromFile(chain, baseToken)
  const baseTokenInstance = new Contract(baseToken, baseTokenAbi, customProvider(chain))
  const { symbol } = await getContractSymbolAndDecimalsFromFile(baseToken, baseTokenInstance, chain)

  const prevInterestRate = annualizeFn((await getInterestRateFunction(currentCometInstance)).toString())
  const previousRateInPercent = percentageFn(prevInterestRate)
  const currentRateInPercent = percentageFn(defactorFn(decodedParams[1]))

  const changeInRate = subtractFn(currentRateInPercent, previousRateInPercent)

  return `Set ${interestRateName} of **[${symbol}](https://${platform}/address/${baseToken})** from ${addCommas(previousRateInPercent)} to ${addCommas(
    currentRateInPercent
  )} ${getChangeTextFn(changeInRate)}`
}

async function getTextForKinkChange(
  chain: CometChains,
  transaction: ExecuteTransactionInfo,
  decodedParams: string[],
  getFunction: (contract: Contract) => Promise<BigNumber>,
  functionName: string,
  platform: string
) {
  const { contractName } = await getContractNameAndAbiFromFile(chain, transaction.target)

  const { abi } = await getContractNameAndAbiFromFile(chain, decodedParams[0])
  const currentCometInstance = new Contract(decodedParams[0], abi, customProvider(chain))

  const baseToken = await currentCometInstance.callStatic.baseToken()
  const { abi: baseTokenAbi } = await getContractNameAndAbiFromFile(chain, baseToken)
  const baseTokenInstance = new Contract(baseToken, baseTokenAbi, customProvider(chain))
  const { symbol } = await getContractSymbolAndDecimalsFromFile(baseToken, baseTokenInstance, chain)

  const prevValue = percentageFn(defactorFn((await getFunction(currentCometInstance)).toString()))
  const newValue = percentageFn(defactorFn(decodedParams[1]))

  const changeInValues = subtractFn(newValue, prevValue)

  return `Set ${functionName} of **[${symbol}](https://${platform}/address/${baseToken})** via **[${contractName}](https://${platform}/address/${
    transaction.target
  }})** from ${addCommas(prevValue)}% to ${addCommas(newValue)}% ${getChangeTextFn(changeInValues, true)}`
}

async function getTextForSpeedChange(
  chain: CometChains,
  transaction: ExecuteTransactionInfo,
  decodedParams: string[],
  getFunction: (contract: Contract) => Promise<BigNumber>,
  functionName: string,
  platform: string,
  speedName: string
) {
  const { contractName } = await getContractNameAndAbiFromFile(chain, transaction.target)

  const { abi } = await getContractNameAndAbiFromFile(chain, decodedParams[0])
  const currentCometInstance = new Contract(decodedParams[0], abi, customProvider(chain))

  const baseToken = await currentCometInstance.callStatic.baseToken()
  const { abi: baseTokenAbi } = await getContractNameAndAbiFromFile(chain, baseToken)
  const baseTokenInstance = new Contract(baseToken, baseTokenAbi, customProvider(chain))
  const { symbol } = await getContractSymbolAndDecimalsFromFile(baseToken, baseTokenInstance, chain)

  const prevSpeedValue = (await getFunction(currentCometInstance)).toString()
  const newSpeedValue = decodedParams[1]
  const changeInSpeedValues = subtractFn(newSpeedValue, prevSpeedValue)

  const prevRewardValue = dailyRateFn(defactorFn(prevSpeedValue, '15'))
  const newRewardValue = dailyRateFn(defactorFn(newSpeedValue, '15'))
  const changeInRewardValues = subtractFn(newRewardValue, prevRewardValue)

  return `Set ${functionName} of **[${symbol}](https://${platform}/address/${baseToken}) [${contractName}](https://${platform}/address/${
    transaction.target
  })** from ${addCommas(prevSpeedValue)} to ${addCommas(newSpeedValue)} ${getChangeTextFn(
    changeInSpeedValues
  )}. Hence changing Daily ${speedName} rewards from ${addCommas(prevRewardValue)} to ${addCommas(newRewardValue)} ${getChangeTextFn(changeInRewardValues)}`
}

export const configuratorFormatters: { [functionName: string]: TransactionFormatter } = {
  'setBorrowPerYearInterestRateBase(address,uint64)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    return getTextForChangeInInterestRate(
      chain,
      decodedParams,
      async (contract) => await contract.callStatic.borrowPerSecondInterestRateBase(),
      'BorrowPerYearInterestRateBase',
      getPlatform(chain)
    )
  },
  'setBorrowPerYearInterestRateSlopeLow(address,uint64)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    return getTextForChangeInInterestRate(
      chain,
      decodedParams,
      async (contract) => await contract.callStatic.borrowPerSecondInterestRateSlopeLow(),
      'BorrowPerYearInterestRateSlopeLow',
      getPlatform(chain)
    )
  },
  'setBorrowPerYearInterestRateSlopeHigh(address,uint64)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    return getTextForChangeInInterestRate(
      chain,
      decodedParams,
      async (contract) => await contract.callStatic.borrowPerSecondInterestRateSlopeHigh(),
      'BorrowPerYearInterestRateSlopeHigh',
      getPlatform(chain)
    )
  },
  'setSupplyPerYearInterestRateSlopeLow(address,uint64)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    return getTextForChangeInInterestRate(
      chain,
      decodedParams,
      async (contract) => await contract.callStatic.supplyPerSecondInterestRateSlopeLow(),
      'SupplyPerYearInterestRateSlopeLow',
      getPlatform(chain)
    )
  },
  'setSupplyPerYearInterestRateSlopeHigh(address,uint64)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    return getTextForChangeInInterestRate(
      chain,
      decodedParams,
      async (contract) => await contract.callStatic.supplyPerSecondInterestRateSlopeHigh(),
      'SupplyPerYearInterestRateSlopeHigh',
      getPlatform(chain)
    )
  },
  'setBaseTrackingBorrowSpeed(address,uint64)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    return getTextForSpeedChange(
      chain,
      transaction,
      decodedParams,
      async (contract) => await contract.callStatic.baseTrackingBorrowSpeed(),
      'BaseTrackingBorrowSpeed',
      getPlatform(chain),
      'Borrow'
    )
  },
  'setBaseTrackingSupplySpeed(address,uint64)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    return getTextForSpeedChange(
      chain,
      transaction,
      decodedParams,
      async (contract) => await contract.callStatic.baseTrackingSupplySpeed(),
      'BaseTrackingSupplySpeed',
      getPlatform(chain),
      'Supply'
    )
  },
  'setBorrowKink(address,uint64)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    return getTextForKinkChange(chain, transaction, decodedParams, async (contract) => await contract.callStatic.borrowKink(), 'BorrowKink', getPlatform(chain))
  },
  'setSupplyKink(address,uint64)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    return getTextForKinkChange(chain, transaction, decodedParams, async (contract) => await contract.callStatic.supplyKink(), 'SupplyKink', getPlatform(chain))
  },
  'updateAssetLiquidationFactor(address,address,uint64)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = getPlatform(chain)
    const { contractName } = await getContractNameAndAbiFromFile(chain, transaction.target)

    const { abi } = await getContractNameAndAbiFromFile(chain, decodedParams[1])
    const tokenInstance = new Contract(decodedParams[1], abi, customProvider(chain))
    const { symbol: tokenSymbol } = await getContractSymbolAndDecimalsFromFile(decodedParams[1], tokenInstance, chain)

    const { abi: baseAbi } = await getContractNameAndAbiFromFile(chain, decodedParams[0])
    const currentBaseTokenInstance = new Contract(decodedParams[0], baseAbi, customProvider(chain))

    const assetInfo = await currentBaseTokenInstance.callStatic.getAssetInfoByAddress(decodedParams[1])

    const prevLiquidationFactor = percentageFn(defactorFn(assetInfo.liquidationFactor.toString()))
    const newLiquidationFactor = percentageFn(defactorFn(decodedParams[2]))
    const baseToken = await currentBaseTokenInstance.callStatic.baseToken()

    const { abi: baseTokenAbi } = await getContractNameAndAbiFromFile(chain, baseToken)
    const baseTokenInstance = new Contract(baseToken, baseTokenAbi, customProvider(chain))
    const { symbol: baseTokenSymbol } = await getContractSymbolAndDecimalsFromFile(baseToken, baseTokenInstance, chain)

    const changeInLiquidationFactor = subtractFn(newLiquidationFactor, prevLiquidationFactor)

    return `${getCriticalitySign(changeInLiquidationFactor, 5)} Set liquidation factor for **[${tokenSymbol}](https://${platform}/address/${
      decodedParams[1]
    })** on **[${baseTokenSymbol}](https://${platform}/address/${baseToken})** via **[${contractName}](https://${platform}/address/${
      transaction.target
    })** from ${prevLiquidationFactor}% to ${newLiquidationFactor}% ${getChangeTextFn(changeInLiquidationFactor, true)}`
  },
  'updateAssetSupplyCap(address,address,uint128)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = getPlatform(chain)
    const { contractName } = await getContractNameAndAbiFromFile(chain, transaction.target)

    const { abi } = await getContractNameAndAbiFromFile(chain, decodedParams[1])
    const tokenInstance = new Contract(decodedParams[1], abi, customProvider(chain))
    const { symbol: tokenSymbol, decimals } = await getContractSymbolAndDecimalsFromFile(decodedParams[1], tokenInstance, chain)

    const { abi: baseAbi } = await getContractNameAndAbiFromFile(chain, decodedParams[0])
    const currentBaseTokenInstance = new Contract(decodedParams[0], baseAbi, customProvider(chain))
    const assetInfo = await currentBaseTokenInstance.callStatic.getAssetInfoByAddress(decodedParams[1])

    const prevSupplyCap = defactorFn(assetInfo.supplyCap.toString(), `${decimals}`)
    const baseToken = await currentBaseTokenInstance.callStatic.baseToken()

    const { abi: baseTokenAbi } = await getContractNameAndAbiFromFile(chain, baseToken)
    const baseTokenInstance = new Contract(baseToken, baseTokenAbi, customProvider(chain))
    const { symbol: baseTokenSymbol } = await getContractSymbolAndDecimalsFromFile(baseToken, baseTokenInstance, chain)

    const newSupplyCap = defactorFn(decodedParams[2], `${decimals}`)

    const changeInSupplyCap = subtractFn(newSupplyCap, prevSupplyCap)

    return `${getCriticalitySign(changeInSupplyCap, 1000000)} Set supply cap for **[${tokenSymbol}](https://${platform}/address/${
      decodedParams[1]
    })** on **[${baseTokenSymbol}](https://${platform}/address/${baseToken})** via **[${contractName}](https://${platform}/address/${
      transaction.target
    })** from ${addCommas(prevSupplyCap)} to ${addCommas(newSupplyCap)} ${getChangeTextFn(changeInSupplyCap)}`
  },
  'setBaseBorrowMin(address,uint104)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = getPlatform(chain)

    const { abi } = await getContractNameAndAbiFromFile(chain, decodedParams[0])
    const currentInstance = new Contract(decodedParams[0], abi, customProvider(chain))

    const baseToken = await currentInstance.callStatic.baseToken()
    const { abi: baseTokenAbi } = await getContractNameAndAbiFromFile(chain, baseToken)
    const baseTokenInstance = new Contract(baseToken, baseTokenAbi, customProvider(chain))
    const { symbol, decimals } = await getContractSymbolAndDecimalsFromFile(baseToken, baseTokenInstance, chain)

    const baseBorrowMin = (await currentInstance.callStatic.baseBorrowMin()).toString()
    const prevBaseBorrowMin = defactorFn(baseBorrowMin, `${decimals}`)
    const newBaseBorrowMin = defactorFn(decodedParams[1], `${decimals}`)

    const changeInBaseBorrowMin = subtractFn(newBaseBorrowMin, prevBaseBorrowMin)

    return `Set BaseBorrowMin of **[${symbol}](https://${platform}/address/${decodedParams[0]})** from ${addCommas(prevBaseBorrowMin)} to ${addCommas(
      newBaseBorrowMin
    )} ${getChangeTextFn(changeInBaseBorrowMin)}`
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

    const borrowCollateralFactor = defactorFn(tupleList[3], `${assetDecimals}`)
    const liquidateCollateralFactor = defactorFn(tupleList[4], `${assetDecimals}`)
    const liquidationFactor = defactorFn(tupleList[5], `${assetDecimals}`)
    const supplyCap = defactorFn(tupleList[6], `${assetDecimals}`)

    let assetTable = ''
    assetTable += `| Parameter | Value |\n`
    assetTable += `|-----------|-------|\n`
    assetTable += `| Asset | [${assetSymbol}](https://${platform}/address/${assetAddress}) |\n`
    assetTable += `| PriceFeed | [PriceFeed](https://${platform}/address/${tupleList[1]}) |\n`
    assetTable += `| Decimals | ${assetDecimals} |\n`
    assetTable += `| BorrowCollateralFactor | ${percentageFn(borrowCollateralFactor)}% |\n`
    assetTable += `| LiquidateCollateralFactor |  ${percentageFn(liquidateCollateralFactor)}% |\n`
    assetTable += `| LiquidationFactor | ${percentageFn(liquidationFactor)}% |\n`
    assetTable += `| SupplyCap | ${addCommas(supplyCap)} |\n\n`

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
        priceFeed: `**[PriceFeed](https://${platform}/address/${tupleList[i + 1]})**`,
        decimals: tupleList[i + 2],
        borrowCollateralFactor: percentageFn(defactorFn(tupleList[i + 3])) + `%`,
        liquidateCollateralFactor: percentageFn(defactorFn(tupleList[i + 4])) + `%`,
        liquidationFactor: percentageFn(defactorFn(tupleList[i + 5])) + `%`,
        supplyCap: addCommas(defactorValue(6)),
      }

      assetConfigs.push(assetConfigBlock)
    }

    function generateAssetConfigTables(assetConfigs: AssetConfig[]) {
      let tablesString = ''
      assetConfigs.forEach((config) => {
        tablesString += `\n\n${tab}Asset Configuration for ${config.asset}:\n${tab}`
        tablesString += `| Parameter | Value |\n`
        tablesString += `|-----------|-------|\n`
        tablesString += `| Asset | ${config.asset} |\n`
        tablesString += `| PriceFeed | ${config.priceFeed} |\n`
        tablesString += `| Decimals | ${config.decimals} |\n`
        tablesString += `| BorrowCollateralFactor | ${config.borrowCollateralFactor} |\n`
        tablesString += `| LiquidateCollateralFactor | ${config.liquidateCollateralFactor} |\n`
        tablesString += `| LiquidationFactor | ${config.liquidationFactor} |\n`
        tablesString += `| SupplyCap | ${config.supplyCap} |`
      })
      return tablesString
    }

    const assetConfigTables = generateAssetConfigTables(assetConfigs)

    let mainTable = `| Parameter | Value |\n|-----------|-------|\n`
    mainTable += `| Governor | **[${governor}](https://${platform}/address/${tupleList[0]})** |\n`
    mainTable += `| PauseGuardian | ${await getRecipientNameWithLink(chain, tupleList[1])} |\n`
    mainTable += `| BaseToken | **[${baseSymbol}](https://${platform}/address/${tupleList[2]})** |\n`
    mainTable += `| BaseToken PriceFeed | **[PriceFeed](https://${platform}/address/${tupleList[3]})** |\n`
    mainTable += `| ExtensionDelegate | ${await getRecipientNameWithLink(chain, tupleList[4])} |\n`
    mainTable += `| SupplyKink | ${percentageFn(supplyKink)}% |\n`
    mainTable += `| SupplyPerYearInterestRateSlopeLow | ${percentageFn(supplyPerYearInterestRateSlopeLow)}% |\n`
    mainTable += `| SupplyPerYearInterestRateSlopeHigh | ${percentageFn(supplyPerYearInterestRateSlopeHigh)}% |\n`
    mainTable += `| SupplyPerYearInterestRateBase | ${percentageFn(supplyPerYearInterestRateBase)}% |\n`
    mainTable += `| BorrowKink | ${percentageFn(borrowKink)}% |\n`
    mainTable += `| BorrowPerYearInterestRateSlopeLow | ${percentageFn(borrowPerYearInterestRateSlopeLow)}% |\n`
    mainTable += `| BorrowPerYearInterestRateSlopeHigh | ${percentageFn(borrowPerYearInterestRateSlopeHigh)}% |\n`
    mainTable += `| BorrowPerYearInterestRateBase | ${percentageFn(borrowPerYearInterestRateBase)}% |\n`
    mainTable += `| StoreFrontPriceFactor | ${percentageFn(storeFrontPriceFactor)}% |\n`
    mainTable += `| TrackingIndexScale | ${addCommas(trackingIndexScale)} |\n`
    mainTable += `| BaseTrackingSupplySpeed | ${addCommas(baseTrackingSupplySpeed)} |\n`
    mainTable += `| BaseTrackingBorrowSpeed | ${addCommas(baseTrackingBorrowSpeed)} |\n`
    mainTable += `| BaseMinForRewards | ${addCommas(baseMinForRewards)} |\n`
    mainTable += `| BaseBorrowMin | ${addCommas(baseBorrowMin)} |\n`
    mainTable += `| TargetReserves | ${addCommas(targetReserves)} |\n`

    return `🛑 Set configuration for **[${contractBaseSymbol}](https://${platform}/address/${contractBaseToken})** to: \n\n${tab}${mainTable}\n${tab}${assetConfigTables}`
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

    return `${getCriticalitySign(
      changeInFactor,
      15
    )}Set StoreFrontPriceFactor for ${tokenNameWithLink} from ${priceFactorOld}% to ${priceFactorNew}% ${getChangeTextFn(changeInFactor, true)}`
  },
}
