import { BigNumber, Contract } from 'ethers'
import { customProvider } from '../../../utils/clients/ethers'
import { getContractNameAndAbiFromFile } from './../abi-utils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from './../compound-types'
import {
  annualize,
  defactor,
  calculateDifferenceOfDecimals,
  getPlatform,
  getContractSymbolAndDecimalsFromFile,
  getPercentageForTokenFactor,
  getFormattedTokenNameWithLink,
  getChangeText,
  getCriticalitySign,
  fetchIdFromGecko,
  fetchDataForAsset,
  getPlatformFromGecko,
  addCommas,
} from './helper'

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

  const prevInterestRate = annualize(await getInterestRateFunction(currentCometInstance))
  const previousRateInPercent = parseFloat((prevInterestRate * 100).toPrecision(3))

  const newInterestRate = BigInt(decodedParams[1])
  const currentRateInPercent = defactor(newInterestRate) * 100

  const changeInRate = calculateDifferenceOfDecimals(currentRateInPercent, previousRateInPercent)

  return `Set ${interestRateName} of [${symbol}](https://${platform}/address/${baseToken}) from ${previousRateInPercent} to ${currentRateInPercent} ${getChangeText(
    changeInRate
  )}`
}

async function getTextForChange(
  chain: CometChains,
  decodedParams: string[],
  getFunction: (contract: Contract) => Promise<BigNumber>,
  functionName: string,
  platform: string
) {
  const { abi } = await getContractNameAndAbiFromFile(chain, decodedParams[0])
  const currentCometInstance = new Contract(decodedParams[0], abi, customProvider(chain))

  const baseToken = await currentCometInstance.callStatic.baseToken()
  const { abi: baseTokenAbi } = await getContractNameAndAbiFromFile(chain, baseToken)
  const baseTokenInstance = new Contract(baseToken, baseTokenAbi, customProvider(chain))
  const { symbol } = await getContractSymbolAndDecimalsFromFile(baseToken, baseTokenInstance, chain)

  const prevValue = defactor(await getFunction(currentCometInstance))

  const newValue = defactor(BigInt(decodedParams[1]))

  const changeInValues = calculateDifferenceOfDecimals(newValue, prevValue)

  return `Set ${functionName} of [${symbol}](https://${platform}/address/${baseToken}) from ${prevValue} to ${newValue} ${getChangeText(changeInValues)}`
}

export const configuratorFormatters: { [functionName: string]: TransactionFormatter } = {
  'setBorrowPerYearInterestRateBase(address,uint64)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    return getTextForChangeInInterestRate(
      chain,
      decodedParams,
      async (contract) => await contract.callStatic.borrowPerSecondInterestRateBase(),
      'BorrowPerYearInterestRateBase',
      await getPlatform(chain)
    )
  },
  'setBorrowPerYearInterestRateSlopeLow(address,uint64)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    return getTextForChangeInInterestRate(
      chain,
      decodedParams,
      async (contract) => await contract.callStatic.borrowPerSecondInterestRateSlopeLow(),
      'BorrowPerYearInterestRateSlopeLow',
      await getPlatform(chain)
    )
  },
  'setBorrowPerYearInterestRateSlopeHigh(address,uint64)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    return getTextForChangeInInterestRate(
      chain,
      decodedParams,
      async (contract) => await contract.callStatic.borrowPerSecondInterestRateSlopeHigh(),
      'BorrowPerYearInterestRateSlopeHigh',
      await getPlatform(chain)
    )
  },
  'setSupplyPerYearInterestRateSlopeLow(address,uint64)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    return getTextForChangeInInterestRate(
      chain,
      decodedParams,
      async (contract) => await contract.callStatic.supplyPerSecondInterestRateSlopeLow(),
      'SupplyPerYearInterestRateSlopeLow',
      await getPlatform(chain)
    )
  },
  'setSupplyPerYearInterestRateSlopeHigh(address,uint64)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    return getTextForChangeInInterestRate(
      chain,
      decodedParams,
      async (contract) => await contract.callStatic.supplyPerSecondInterestRateSlopeHigh(),
      'SupplyPerYearInterestRateSlopeHigh',
      await getPlatform(chain)
    )
  },
  'deployAndUpgradeTo(address,address)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = await getPlatform(chain)

    const { contractName } = await getContractNameAndAbiFromFile(chain, decodedParams[0])

    const { abi } = await getContractNameAndAbiFromFile(chain, decodedParams[1])
    const currentCometInstance = new Contract(decodedParams[1], abi, customProvider(chain))

    const baseToken = await currentCometInstance.callStatic.baseToken()
    const { abi: baseTokenAbi } = await getContractNameAndAbiFromFile(chain, baseToken)
    const baseTokenInstance = new Contract(baseToken, baseTokenAbi, customProvider(chain))
    const { symbol } = await getContractSymbolAndDecimalsFromFile(baseToken, baseTokenInstance, chain)

    return `Deploy and upgrade new implementation for [${symbol}](https://${platform}/address/${baseToken}) via [${contractName}](https://${platform}/address/${decodedParams[0]}).`
  },
  'setBaseTrackingBorrowSpeed(address,uint64)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    return getTextForChange(
      chain,
      decodedParams,
      async (contract) => await contract.callStatic.baseTrackingBorrowSpeed(),
      'BaseTrackingBorrowSpeed',
      await getPlatform(chain)
    )
  },
  'setBaseTrackingSupplySpeed(address,uint64)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    return getTextForChange(
      chain,
      decodedParams,
      async (contract) => await contract.callStatic.baseTrackingSupplySpeed(),
      'BaseTrackingSupplySpeed',
      await getPlatform(chain)
    )
  },
  'setBorrowKink(address,uint64)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    return getTextForChange(chain, decodedParams, async (contract) => await contract.callStatic.borrowKink(), 'BorrowKink', await getPlatform(chain))
  },
  'setSupplyKink(address,uint64)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    return getTextForChange(chain, decodedParams, async (contract) => await contract.callStatic.supplyKink(), 'SupplyKink', await getPlatform(chain))
  },
  'updateAssetLiquidationFactor(address,address,uint64)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = await getPlatform(chain)
    const { contractName } = await getContractNameAndAbiFromFile(chain, transaction.target)

    const { abi } = await getContractNameAndAbiFromFile(chain, decodedParams[1])
    const tokenInstance = new Contract(decodedParams[1], abi, customProvider(chain))
    const { symbol: tokenSymbol } = await getContractSymbolAndDecimalsFromFile(decodedParams[1], tokenInstance, chain)

    const { abi: baseAbi } = await getContractNameAndAbiFromFile(chain, decodedParams[0])
    const currentBaseTokenInstance = new Contract(decodedParams[0], baseAbi, customProvider(chain))

    const assetInfo = await currentBaseTokenInstance.callStatic.getAssetInfoByAddress(decodedParams[1])

    const prevLiquidationFactor = getPercentageForTokenFactor(assetInfo.liquidationFactor)
    const newLiquidationFactor = getPercentageForTokenFactor(decodedParams[2])
    const baseToken = await currentBaseTokenInstance.callStatic.baseToken()

    const { abi: baseTokenAbi } = await getContractNameAndAbiFromFile(chain, baseToken)
    const baseTokenInstance = new Contract(baseToken, baseTokenAbi, customProvider(chain))
    const { symbol: baseTokenSymbol } = await getContractSymbolAndDecimalsFromFile(baseToken, baseTokenInstance, chain)

    const changeInLiquidationFactor = calculateDifferenceOfDecimals(parseFloat(newLiquidationFactor), parseFloat(prevLiquidationFactor))

    return `${getCriticalitySign(changeInLiquidationFactor, 5)} Set liquidation factor for [${tokenSymbol}](https://${platform}/address/${
      decodedParams[1]
    }) on [${baseTokenSymbol}](https://${platform}/address/${baseToken}) via [${contractName}](https://${platform}/address/${
      transaction.target
    }) from **${prevLiquidationFactor}%** to **${newLiquidationFactor}%** ${getChangeText(changeInLiquidationFactor, true)}`
  },
  'updateAssetSupplyCap(address,address,uint128)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = await getPlatform(chain)
    const { contractName } = await getContractNameAndAbiFromFile(chain, transaction.target)

    const { abi } = await getContractNameAndAbiFromFile(chain, decodedParams[1])
    const tokenInstance = new Contract(decodedParams[1], abi, customProvider(chain))
    const { symbol: tokenSymbol, decimals } = await getContractSymbolAndDecimalsFromFile(decodedParams[1], tokenInstance, chain)

    const { abi: baseAbi } = await getContractNameAndAbiFromFile(chain, decodedParams[0])
    const currentBaseTokenInstance = new Contract(decodedParams[0], baseAbi, customProvider(chain))
    const assetInfo = await currentBaseTokenInstance.callStatic.getAssetInfoByAddress(decodedParams[1])

    const prevSupplyCap = defactor(assetInfo.supplyCap, parseFloat(`1e${decimals}`))
    const baseToken = await currentBaseTokenInstance.callStatic.baseToken()

    const { abi: baseTokenAbi } = await getContractNameAndAbiFromFile(chain, baseToken)
    const baseTokenInstance = new Contract(baseToken, baseTokenAbi, customProvider(chain))
    const { symbol: baseTokenSymbol } = await getContractSymbolAndDecimalsFromFile(baseToken, baseTokenInstance, chain)

    const newSupplyCap = defactor(BigInt(decodedParams[2]), parseFloat(`1e${decimals}`))

    const changeInSupplyCap = calculateDifferenceOfDecimals(newSupplyCap, prevSupplyCap)

    return `${getCriticalitySign(changeInSupplyCap, 10000)} Set supply cap for [${tokenSymbol}](https://${platform}/address/${
      decodedParams[1]
    }) on [${baseTokenSymbol}](https://${platform}/address/${baseToken}) via [${contractName}](https://${platform}/address/${
      transaction.target
    }) from **${prevSupplyCap.toFixed(2)}** to **${newSupplyCap.toFixed(2)}** ${getChangeText(changeInSupplyCap)}`
  },
  'setBaseBorrowMin(address,uint104)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = await getPlatform(chain)

    const { abi } = await getContractNameAndAbiFromFile(chain, decodedParams[0])
    const currentInstance = new Contract(decodedParams[0], abi, customProvider(chain))

    const baseToken = await currentInstance.callStatic.baseToken()
    const { abi: baseTokenAbi } = await getContractNameAndAbiFromFile(chain, baseToken)
    const baseTokenInstance = new Contract(baseToken, baseTokenAbi, customProvider(chain))
    const { symbol, decimals } = await getContractSymbolAndDecimalsFromFile(baseToken, baseTokenInstance, chain)

    const prevBaseBorrowMin = defactor(await currentInstance.callStatic.baseBorrowMin(), parseFloat(`1e${decimals}`))
    const newBaseBorrowMin = defactor(BigInt(decodedParams[1]), parseFloat(`1e${decimals}`))

    const changeInBaseBorrowMin = calculateDifferenceOfDecimals(newBaseBorrowMin, prevBaseBorrowMin)

    return `Set BaseBorrowMin of [${symbol}](https://${platform}/address/${
      decodedParams[0]
    }) from **${prevBaseBorrowMin}** to **${newBaseBorrowMin}** ${getChangeText(changeInBaseBorrowMin)}`
  },
  'addAsset(address,tuple)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = await getPlatform(chain)

    const [address, tuple] = decodedParams
    const tupleList = tuple.split(',')
    const assetAddress = tupleList[0]
    const { abi: contractAbi } = await getContractNameAndAbiFromFile(chain, address)
    const contractInstance = new Contract(address, contractAbi, customProvider(chain))

    const baseToken = await contractInstance.callStatic.baseToken()
    const { abi: baseTokenAbi } = await getContractNameAndAbiFromFile(chain, baseToken)
    const baseTokenInstance = new Contract(baseToken, baseTokenAbi, customProvider(chain))
    const { symbol } = await getContractSymbolAndDecimalsFromFile(baseToken, baseTokenInstance, chain)

    const { abi: assetAbi } = await getContractNameAndAbiFromFile(chain, tupleList[0])
    const assetInstance = new Contract(tupleList[0], assetAbi, customProvider(chain))
    const { symbol: assetSymbol, decimals: assetDecimals } = await getContractSymbolAndDecimalsFromFile(tupleList[0], assetInstance, chain)

    const borrowCollateralFactor = defactor(BigInt(tupleList[3]), parseFloat(`1e${assetDecimals}`))
    const liquidateCollateralFactor = defactor(BigInt(tupleList[4]), parseFloat(`1e${assetDecimals}`))
    const liquidationFactor = defactor(BigInt(tupleList[5]), parseFloat(`1e${assetDecimals}`))
    const supplyCap = defactor(BigInt(tupleList[6]), parseFloat(`1e${assetDecimals}`))

    let geckoResponse = ''
    const assetID = await fetchIdFromGecko(assetSymbol)
    if (assetID) {
      await fetchDataForAsset(assetID).then((assetData) => {
        geckoResponse += '\n\n**Asset Information From CoinGecko:**\n\n'
        const platform = getPlatformFromGecko(chain)
        const assetAddressOnGecko = assetData.platforms[`${platform}`]
        geckoResponse +=
          assetAddressOnGecko.toLowerCase() === assetAddress.toLowerCase()
            ? `* 🟢 Asset address is verified on CoinGecko.`
            : `* 🔴 Asset address is not verified on CoinGecko.`
        geckoResponse += `\n\n* Asset has Market cap rank of ${assetData.market_cap_rank} \n\n* Current price of ${addCommas(
          assetData.market_data.current_price.usd
        )} USD \n\n* Price change in 24hrs is ${addCommas(assetData.market_data.price_change_percentage_24h)}% \n\n* Market cap is ${addCommas(
          assetData.market_data.market_cap_change_24h_in_currency.usd
        )} USD \n\n* Total volume is ${addCommas(assetData.market_data.total_volume.usd)} USD \n\n* Total supply is ${addCommas(
          assetData.market_data.total_supply.toFixed(2)
        )}`
      })
    }

    return `🛑 Add new asset to market [${symbol}](https://${platform}/address/${baseToken}) with following asset configuration: \n\n{\n\n**asset:** [${assetSymbol}](https://${platform}/address/${assetAddress}),\n\n**priceFeed:** ${
      tupleList[1]
    },\n\n**decimals:** ${assetDecimals},\n\n**borrowCollateralFactor:** ${borrowCollateralFactor.toFixed(
      2
    )},\n\n**liquidateCollateralFactor:** ${liquidateCollateralFactor.toFixed(2)},\n\n**liquidationFactor:** ${liquidationFactor.toFixed(
      2
    )},\n\n**supplyCap:** ${supplyCap.toFixed(2)}\n\n}
    \n\n${geckoResponse}`
  },
  'setRewardConfig(address,address)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = await getPlatform(chain)

    const { abi } = await getContractNameAndAbiFromFile(chain, decodedParams[0])
    const currentInstance = new Contract(decodedParams[0], abi, customProvider(chain))

    const baseToken = await currentInstance.callStatic.baseToken()
    const { abi: baseTokenAbi } = await getContractNameAndAbiFromFile(chain, baseToken)
    const baseTokenInstance = new Contract(baseToken, baseTokenAbi, customProvider(chain))
    const { symbol: tokenSymbol } = await getContractSymbolAndDecimalsFromFile(baseToken, baseTokenInstance, chain)

    const { abi: compAbi } = await getContractNameAndAbiFromFile(chain, decodedParams[1])
    const compInstance = new Contract(decodedParams[1], compAbi, customProvider(chain))
    const { symbol } = await getContractSymbolAndDecimalsFromFile(decodedParams[1], compInstance, chain)

    return `⚠️ Set reward token for market [${tokenSymbol}](https://${platform}/address/${baseToken}) as [${symbol}](https://${platform}/address/${decodedParams[1]}).`
  },
  'setFactory(address,address)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = await getPlatform(chain)

    const { abi } = await getContractNameAndAbiFromFile(chain, decodedParams[0])
    const currentInstance = new Contract(decodedParams[0], abi, customProvider(chain))

    const baseToken = await currentInstance.callStatic.baseToken()
    const { abi: baseTokenAbi } = await getContractNameAndAbiFromFile(chain, baseToken)
    const baseTokenInstance = new Contract(baseToken, baseTokenAbi, customProvider(chain))
    const { symbol: tokenSymbol } = await getContractSymbolAndDecimalsFromFile(baseToken, baseTokenInstance, chain)

    const { contractName } = await getContractNameAndAbiFromFile(chain, decodedParams[1])

    return `🛑 Set factory of [${tokenSymbol}](https://${platform}/address/${baseToken}) to [${contractName}](https://${platform}/address/${decodedParams[1]})`
  },
  'setConfiguration(address,tuple)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = await getPlatform(chain)

    const [address, tuple] = decodedParams
    const tupleList = tuple.split(',')

    const { abi: contractAbi } = await getContractNameAndAbiFromFile(chain, address)
    const contractInstance = new Contract(address, contractAbi, customProvider(chain))
    const contractBaseToken = await contractInstance.callStatic.baseToken()
    const { abi: contractBaseTokenAbi } = await getContractNameAndAbiFromFile(chain, contractBaseToken)
    const contractBaseTokenInstance = new Contract(contractBaseToken, contractBaseTokenAbi, customProvider(chain))
    const { symbol: contractBaseSymbol } = await getContractSymbolAndDecimalsFromFile(contractBaseToken, contractBaseTokenInstance, chain)
    const { contractName: governor } = await getContractNameAndAbiFromFile(chain, tupleList[0])
    const { contractName: pauseGuardian } = await getContractNameAndAbiFromFile(chain, tupleList[1])

    const { abi: baseTokenAbi } = await getContractNameAndAbiFromFile(chain, tupleList[2])
    const baseTokenInstance = new Contract(tupleList[2], baseTokenAbi, customProvider(chain))
    const { symbol: baseSymbol } = await getContractSymbolAndDecimalsFromFile(tupleList[2], baseTokenInstance, chain)

    const { abi: extensionDelegateAbi } = await getContractNameAndAbiFromFile(chain, tupleList[4])
    const extensionDelegateInstance = new Contract(tupleList[4], extensionDelegateAbi, customProvider(chain))
    const extensionDelegateSymbol = await extensionDelegateInstance.callStatic.symbol()

    const supplyKink = defactor(BigInt(tupleList[5]))
    const supplyPerYearInterestRateSlopeLow = defactor(BigInt(tupleList[6]))
    const supplyPerYearInterestRateSlopeHigh = defactor(BigInt(tupleList[7]))
    const supplyPerYearInterestRateBase = defactor(BigInt(tupleList[8]))
    const borrowKink = defactor(BigInt(tupleList[9]))
    const borrowPerYearInterestRateSlopeLow = defactor(BigInt(tupleList[10]))
    const borrowPerYearInterestRateSlopeHigh = defactor(BigInt(tupleList[11]))
    const borrowPerYearInterestRateBase = defactor(BigInt(tupleList[12]))
    const storeFrontPriceFactor = defactor(BigInt(tupleList[13]))
    const trackingIndexScale = tupleList[14]
    const baseTrackingSupplySpeed = tupleList[15] //unknown division format as units not clear
    const baseTrackingBorrowSpeed = tupleList[16] //unknown division format as units not clear
    const baseMinForRewards = defactor(BigInt(tupleList[17]))
    const baseBorrowMin = defactor(BigInt(tupleList[18]))
    const targetReserves = defactor(BigInt(tupleList[19]))

    const assetConfigs: AssetConfig[] = []

    for (let i = 20; i < tupleList.length; i += 7) {
      const { abi: assetAbi } = await getContractNameAndAbiFromFile(chain, tupleList[i])
      const assetInstance = new Contract(tupleList[i], assetAbi, customProvider(chain))
      const { symbol: assetSymbol } = await getContractSymbolAndDecimalsFromFile(tupleList[i], assetInstance, chain)
      const defactorValue = (index: number) => defactor(BigInt(tupleList[i + index]), parseFloat(`1e${tupleList[i + 2]}`))

      const assetConfigBlock: AssetConfig = {
        asset: `[${assetSymbol}](https://${platform}/address/${tupleList[i]})`,
        priceFeed: tupleList[i + 1],
        decimals: tupleList[i + 2],
        borrowCollateralFactor: defactorValue(3).toFixed(2),
        liquidateCollateralFactor: defactorValue(4).toFixed(2),
        liquidationFactor: defactorValue(5).toFixed(2),
        supplyCap: defactorValue(6).toFixed(2),
      }

      assetConfigs.push(assetConfigBlock)
    }

    return `🛑 Set configuration for [${contractBaseSymbol}](https://${platform}/address/${contractBaseToken}) to: \n\n{
      governor: [${governor}](https://${platform}/address/${tupleList[0]}),
      pauseGuardian: [${pauseGuardian}](https://${platform}/address/${tupleList[1]}),
      baseToken: [${baseSymbol}](https://${platform}/address/${tupleList[2]}),
      baseTokenPriceFeed: [PriceFeed](https://${platform}/address/${tupleList[3]}),
      extensionDelegate: [${extensionDelegateSymbol}](https://${platform}/address/${tupleList[4]}),
      supplyKink: ${(supplyKink * 100).toFixed(2)},
      supplyPerYearInterestRateSlopeLow: ${supplyPerYearInterestRateSlopeLow.toFixed(4)},
      supplyPerYearInterestRateSlopeHigh: ${supplyPerYearInterestRateSlopeHigh.toFixed(4)},
      supplyPerYearInterestRateBase: ${supplyPerYearInterestRateBase.toFixed(4)},
      borrowKink: ${(borrowKink * 100).toFixed(2)},
      borrowPerYearInterestRateSlopeLow: ${borrowPerYearInterestRateSlopeLow.toFixed(4)},
      borrowPerYearInterestRateSlopeHigh: ${borrowPerYearInterestRateSlopeHigh.toFixed(4)},
      borrowPerYearInterestRateBase: ${borrowPerYearInterestRateBase.toFixed(4)},
      storeFrontPriceFactor: ${storeFrontPriceFactor.toFixed(2)},
      trackingIndexScale: ${trackingIndexScale},
      baseTrackingSupplySpeed: ${baseTrackingSupplySpeed},
      baseTrackingBorrowSpeed: ${baseTrackingBorrowSpeed},
      baseMinForRewards: ${baseMinForRewards.toFixed(2)},
      baseBorrowMin: ${baseBorrowMin.toFixed(2)},
      targetReserves: ${targetReserves.toFixed(2)},
      assetConfigs: ${JSON.stringify(assetConfigs, null, 2)}
    }`
  },
  'setStoreFrontPriceFactor(address,uint64)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const { abi } = await getContractNameAndAbiFromFile(chain, decodedParams[0])
    const currentInstance = new Contract(decodedParams[0], abi, customProvider(chain))

    const baseToken = await currentInstance.callStatic.baseToken()

    const tokenNameWithLink = await getFormattedTokenNameWithLink(chain, baseToken)

    const priceFactorOld = getPercentageForTokenFactor(await currentInstance.callStatic.storeFrontPriceFactor())
    const priceFactorNew = getPercentageForTokenFactor(decodedParams[1])

    const changeInFactor = calculateDifferenceOfDecimals(parseFloat(priceFactorNew), parseFloat(priceFactorOld))

    return `${getCriticalitySign(
      changeInFactor,
      15
    )}Set StoreFrontPriceFactor for ${tokenNameWithLink} from **${priceFactorOld}%** to **${priceFactorNew}%** ${getChangeText(changeInFactor, true)}`
  },
}
