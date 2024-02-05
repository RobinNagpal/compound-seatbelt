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
  console.log(`decodedParams ${decodedParams.join(',')}`)

  const { abi } = await getContractNameAndAbiFromFile(chain, decodedParams[0])
  const currentCometInstance = new Contract(decodedParams[0], abi, customProvider(chain))

  const baseToken = await currentCometInstance.callStatic.baseToken()
  const { abi: baseTokenAbi } = await getContractNameAndAbiFromFile(chain, baseToken)
  const baseTokenInstance = new Contract(baseToken, baseTokenAbi, customProvider(chain))
  const { symbol } = await getContractSymbolAndDecimalsFromFile(baseToken, baseTokenInstance, chain)

  const prevInterestRate = annualize(await getInterestRateFunction(currentCometInstance))
  const previousRateInPercent = prevInterestRate * 100
  console.log(`Previous ${interestRateName} ${previousRateInPercent}`)

  const newInterestRate = BigInt(decodedParams[1])
  const currentRateInPercent = defactor(newInterestRate) * 100
  console.log(`New ${interestRateName}: ${currentRateInPercent}`)

  const changeInRate = calculateDifferenceOfDecimals(currentRateInPercent, previousRateInPercent)

  return `\n\nSet ${interestRateName} of [${symbol}](https://${platform}/address/${baseToken}) to ${currentRateInPercent}%. Previous value was ${previousRateInPercent}% and now it is getting ${
    changeInRate > 0 ? 'increased' : 'decreased'
  } by **${changeInRate}%**`
}

async function getTextForChange(
  chain: CometChains,
  decodedParams: string[],
  getFunction: (contract: Contract) => Promise<BigNumber>,
  functionName: string,
  platform: string
) {
  console.log(`decodedParams ${decodedParams.join(',')}`)

  const { abi } = await getContractNameAndAbiFromFile(chain, decodedParams[0])
  const currentCometInstance = new Contract(decodedParams[0], abi, customProvider(chain))

  const baseToken = await currentCometInstance.callStatic.baseToken()
  const { abi: baseTokenAbi } = await getContractNameAndAbiFromFile(chain, baseToken)
  const baseTokenInstance = new Contract(baseToken, baseTokenAbi, customProvider(chain))
  const { symbol } = await getContractSymbolAndDecimalsFromFile(baseToken, baseTokenInstance, chain)

  const prevValue = defactor(await getFunction(currentCometInstance))
  console.log(`Previous BaseTrackingBorrowSpeed: ${prevValue}`)

  const newValue = defactor(BigInt(decodedParams[1]))
  console.log(`New BaseTrackingBorrowSpeed: ${newValue}`)

  const changeInValues = calculateDifferenceOfDecimals(newValue, prevValue)

  return `\n\nSet ${functionName} of [${symbol}](https://${platform}/address/${baseToken}) to ${newValue}%. Previous value was ${prevValue}% and now it is getting ${
    changeInValues > 0 ? 'increased' : 'decreased'
  } by **${changeInValues}%**`
}

export const configuratorFormatters: { [functionName: string]: TransactionFormatter } = {
  'setBorrowPerYearInterestRateBase(address,uint64)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    return getTextForChangeInInterestRate(
      chain,
      decodedParams,
      async (contract) => await contract.callStatic.borrowPerSecondInterestRateBase(),
      'BorrowPerYearInterestRateBase',
      await getPlatform(chain)
    )
  },
  'setBorrowPerYearInterestRateSlopeLow(address,uint64)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    return getTextForChangeInInterestRate(
      chain,
      decodedParams,
      async (contract) => await contract.callStatic.borrowPerSecondInterestRateSlopeLow(),
      'BorrowPerYearInterestRateSlopeLow',
      await getPlatform(chain)
    )
  },
  'setBorrowPerYearInterestRateSlopeHigh(address,uint64)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    return getTextForChangeInInterestRate(
      chain,
      decodedParams,
      async (contract) => await contract.callStatic.borrowPerSecondInterestRateSlopeHigh(),
      'BorrowPerYearInterestRateSlopeHigh',
      await getPlatform(chain)
    )
  },
  'setSupplyPerYearInterestRateSlopeLow(address,uint64)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    return getTextForChangeInInterestRate(
      chain,
      decodedParams,
      async (contract) => await contract.callStatic.supplyPerSecondInterestRateSlopeLow(),
      'SupplyPerYearInterestRateSlopeLow',
      await getPlatform(chain)
    )
  },
  'setSupplyPerYearInterestRateSlopeHigh(address,uint64)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    return getTextForChangeInInterestRate(
      chain,
      decodedParams,
      async (contract) => await contract.callStatic.supplyPerSecondInterestRateSlopeHigh(),
      'SupplyPerYearInterestRateSlopeHigh',
      await getPlatform(chain)
    )
  },
  'deployAndUpgradeTo(address,address)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    const platform = await getPlatform(chain)

    console.log(`decodedParams ${decodedParams.join(',')}`)

    const { contractName } = await getContractNameAndAbiFromFile(chain, decodedParams[0])

    const { abi } = await getContractNameAndAbiFromFile(chain, decodedParams[1])
    const currentCometInstance = new Contract(decodedParams[1], abi, customProvider(chain))

    const baseToken = await currentCometInstance.callStatic.baseToken()
    const { abi: baseTokenAbi } = await getContractNameAndAbiFromFile(chain, baseToken)
    const baseTokenInstance = new Contract(baseToken, baseTokenAbi, customProvider(chain))
    const { symbol } = await getContractSymbolAndDecimalsFromFile(baseToken, baseTokenInstance, chain)

    return `\n\nDeploy and upgrade new implementation for [${symbol}](https://${platform}/address/${baseToken}) via [${contractName}](https://${platform}/address/${decodedParams[0]}).`
  },
  'setBaseTrackingBorrowSpeed(address,uint64)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    return getTextForChange(
      chain,
      decodedParams,
      async (contract) => await contract.callStatic.baseTrackingBorrowSpeed(),
      'BaseTrackingBorrowSpeed',
      await getPlatform(chain)
    )
  },
  'setBaseTrackingSupplySpeed(address,uint64)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    return getTextForChange(
      chain,
      decodedParams,
      async (contract) => await contract.callStatic.baseTrackingSupplySpeed(),
      'BaseTrackingSupplySpeed',
      await getPlatform(chain)
    )
  },
  'setBorrowKink(address,uint64)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    return getTextForChange(
      chain,
      decodedParams,
      async (contract) => await contract.callStatic.borrowKink(),
      'BorrowKink',
      await getPlatform(chain)
    )
  },
  'setSupplyKink(address,uint64)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    return getTextForChange(
      chain,
      decodedParams,
      async (contract) => await contract.callStatic.supplyKink(),
      'SupplyKink',
      await getPlatform(chain)
    )
  },
  'updateAssetLiquidationFactor(address,address,uint64)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    const platform = await getPlatform(chain)

    console.log(`decodedParams ${decodedParams.join(',')}`)

    const { contractName } = await getContractNameAndAbiFromFile(chain, transaction.target)

    const { abi } = await getContractNameAndAbiFromFile(chain, decodedParams[1])
    const tokenInstance = new Contract(decodedParams[1], abi, customProvider(chain))
    const { symbol: tokenSymbol } = await getContractSymbolAndDecimalsFromFile(decodedParams[1], tokenInstance, chain)

    const { abi: baseAbi } = await getContractNameAndAbiFromFile(chain, decodedParams[0])
    const currentBaseTokenInstance = new Contract(decodedParams[0], baseAbi, customProvider(chain))
    const baseToken = await currentBaseTokenInstance.callStatic.baseToken()

    const { abi: baseTokenAbi } = await getContractNameAndAbiFromFile(chain, baseToken)
    const baseTokenInstance = new Contract(baseToken, baseTokenAbi, customProvider(chain))
    const { symbol: baseTokenSymbol } = await getContractSymbolAndDecimalsFromFile(baseToken, baseTokenInstance, chain)

    const token = defactor(BigInt(decodedParams[2]))
    const tokenInPercent = token * 100

    return `\n\nSet liquidation factor for [${tokenSymbol}](https://${platform}/address/${
      decodedParams[1]
    }) on [${baseTokenSymbol}](https://${platform}/address/${baseToken}) via [${contractName}](https://${platform}/address/${
      transaction.target
    }) to ${tokenInPercent.toFixed(1)}%`
  },
  'updateAssetSupplyCap(address,address,uint128)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    const platform = await getPlatform(chain)

    console.log(`decodedParams ${decodedParams.join(',')}`)

    const { contractName } = await getContractNameAndAbiFromFile(chain, transaction.target)

    const { abi } = await getContractNameAndAbiFromFile(chain, decodedParams[1])
    const tokenInstance = new Contract(decodedParams[1], abi, customProvider(chain))
    const { symbol: tokenSymbol, decimals } = await getContractSymbolAndDecimalsFromFile(
      decodedParams[1],
      tokenInstance,
      chain
    )

    const { abi: baseAbi } = await getContractNameAndAbiFromFile(chain, decodedParams[0])
    const currentBaseTokenInstance = new Contract(decodedParams[0], baseAbi, customProvider(chain))
    const baseToken = await currentBaseTokenInstance.callStatic.baseToken()

    const { abi: baseTokenAbi } = await getContractNameAndAbiFromFile(chain, baseToken)
    const baseTokenInstance = new Contract(baseToken, baseTokenAbi, customProvider(chain))
    const { symbol: baseTokenSymbol } = await getContractSymbolAndDecimalsFromFile(baseToken, baseTokenInstance, chain)

    const token = defactor(BigInt(decodedParams[2]), parseFloat(`1e${decimals}`))

    return `\n\nSet supply cap for [${tokenSymbol}](https://${platform}/address/${
      decodedParams[1]
    }) on [${baseTokenSymbol}](https://${platform}/address/${baseToken}) via [${contractName}](https://${platform}/address/${
      transaction.target
    }) to ${token.toFixed(2)}`
  },
  'setBaseBorrowMin(address,uint104)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    const platform = await getPlatform(chain)

    console.log(`decodedParams ${decodedParams.join(',')}`)

    const { abi } = await getContractNameAndAbiFromFile(chain, decodedParams[0])
    const currentInstance = new Contract(decodedParams[0], abi, customProvider(chain))

    const baseToken = await currentInstance.callStatic.baseToken()
    const { abi: baseTokenAbi } = await getContractNameAndAbiFromFile(chain, baseToken)
    const baseTokenInstance = new Contract(baseToken, baseTokenAbi, customProvider(chain))
    const { symbol, decimals } = await getContractSymbolAndDecimalsFromFile(baseToken, baseTokenInstance, chain)

    const prevBaseBorrowMin = defactor(await currentInstance.callStatic.baseBorrowMin(), parseFloat(`1e${decimals}`))
    const newBaseBorrowMin = defactor(BigInt(decodedParams[1]), parseFloat(`1e${decimals}`))

    const changeInBaseBorrowMin = calculateDifferenceOfDecimals(newBaseBorrowMin, prevBaseBorrowMin)

    return `\n\nSet BaseBorrowMin of [${symbol}](https://${platform}/address/${
      decodedParams[0]
    }) to ${newBaseBorrowMin}. Previous value was ${prevBaseBorrowMin} and now it is getting ${
      changeInBaseBorrowMin > 0 ? 'increased' : 'decreased'
    } by **${changeInBaseBorrowMin}**`
  },
  'addAsset(address,tuple)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    const platform = await getPlatform(chain)

    console.log(`decodedParams ${decodedParams.join(',')}`)

    const [address, tuple] = decodedParams
    const tupleList = tuple.split(',')

    const { abi: contractAbi } = await getContractNameAndAbiFromFile(chain, address)
    const contractInstance = new Contract(address, contractAbi, customProvider(chain))

    const baseToken = await contractInstance.callStatic.baseToken()
    const { abi: baseTokenAbi } = await getContractNameAndAbiFromFile(chain, baseToken)
    const baseTokenInstance = new Contract(baseToken, baseTokenAbi, customProvider(chain))
    const { symbol } = await getContractSymbolAndDecimalsFromFile(baseToken, baseTokenInstance, chain)

    const { abi: assetAbi } = await getContractNameAndAbiFromFile(chain, tupleList[0])
    const assetInstance = new Contract(tupleList[0], assetAbi, customProvider(chain))
    const { symbol: assetSymbol, decimals: assetDecimals } = await getContractSymbolAndDecimalsFromFile(
      tupleList[0],
      assetInstance,
      chain
    )

    const borrowCollateralFactor = defactor(BigInt(tupleList[3]), parseFloat(`1e${assetDecimals}`))
    const liquidateCollateralFactor = defactor(BigInt(tupleList[4]), parseFloat(`1e${assetDecimals}`))
    const liquidationFactor = defactor(BigInt(tupleList[5]), parseFloat(`1e${assetDecimals}`))
    const supplyCap = defactor(BigInt(tupleList[6]), parseFloat(`1e${assetDecimals}`))

    return `\n\nAdd new asset to market **[${symbol}](https://${platform}/address/${baseToken})** with following asset configuration: \n\n{\n\n**asset:** [${assetSymbol}](https://${platform}/address/${
      tupleList[0]
    }),\n\n**priceFeed:** ${
      tupleList[1]
    },\n\n**decimals:** ${assetDecimals},\n\n**borrowCollateralFactor:** ${borrowCollateralFactor.toFixed(
      2
    )},\n\n**liquidateCollateralFactor:** ${liquidateCollateralFactor.toFixed(
      2
    )},\n\n**liquidationFactor:** ${liquidationFactor.toFixed(2)},\n\n**supplyCap:** ${supplyCap.toFixed(2)}\n\n}`
  },
  'setRewardConfig(address,address)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    const platform = await getPlatform(chain)

    console.log(`decodedParams ${decodedParams.join(',')}`)

    const { abi } = await getContractNameAndAbiFromFile(chain, decodedParams[0])
    const currentInstance = new Contract(decodedParams[0], abi, customProvider(chain))

    const baseToken = await currentInstance.callStatic.baseToken()
    const { abi: baseTokenAbi } = await getContractNameAndAbiFromFile(chain, baseToken)
    const baseTokenInstance = new Contract(baseToken, baseTokenAbi, customProvider(chain))
    const { symbol: tokenSymbol } = await getContractSymbolAndDecimalsFromFile(baseToken, baseTokenInstance, chain)

    const { abi: compAbi } = await getContractNameAndAbiFromFile(chain, decodedParams[1])
    const compInstance = new Contract(decodedParams[1], compAbi, customProvider(chain))
    const { symbol } = await getContractSymbolAndDecimalsFromFile(decodedParams[1], compInstance, chain)

    return `\n\nSet reward token for market **[${tokenSymbol}](https://${platform}/address/${baseToken})** as **[${symbol}](https://${platform}/address/${decodedParams[1]})**`
  },
  'setFactory(address,address)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    const platform = await getPlatform(chain)

    console.log(`decodedParams ${decodedParams.join(',')}`)

    const { abi } = await getContractNameAndAbiFromFile(chain, decodedParams[0])
    const currentInstance = new Contract(decodedParams[0], abi, customProvider(chain))

    const baseToken = await currentInstance.callStatic.baseToken()
    const { abi: baseTokenAbi } = await getContractNameAndAbiFromFile(chain, baseToken)
    const baseTokenInstance = new Contract(baseToken, baseTokenAbi, customProvider(chain))
    const { symbol: tokenSymbol } = await getContractSymbolAndDecimalsFromFile(baseToken, baseTokenInstance, chain)

    const { contractName } = await getContractNameAndAbiFromFile(chain, decodedParams[1])

    return `\n\nSet factory of **[${tokenSymbol}](https://${platform}/address/${baseToken})** to **[${contractName}](https://${platform}/address/${decodedParams[1]})**`
  },
  'setConfiguration(address,tuple)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    const platform = await getPlatform(chain)

    console.log(`decodedParams ${decodedParams.join(',')}`)

    const [address, tuple] = decodedParams
    const tupleList = tuple.split(',')

    const { abi: contractAbi } = await getContractNameAndAbiFromFile(chain, address)
    const contractInstance = new Contract(address, contractAbi, customProvider(chain))
    const contractBaseToken = await contractInstance.callStatic.baseToken()
    const { abi: contractBaseTokenAbi } = await getContractNameAndAbiFromFile(chain, contractBaseToken)
    const contractBaseTokenInstance = new Contract(contractBaseToken, contractBaseTokenAbi, customProvider(chain))
    const { symbol: contractBaseSymbol } = await getContractSymbolAndDecimalsFromFile(
      contractBaseToken,
      contractBaseTokenInstance,
      chain
    )
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
      const defactorValue = (index: number) =>
        defactor(BigInt(tupleList[i + index]), parseFloat(`1e${tupleList[i + 2]}`))

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

    return `\n\nSet configuration for **[${contractBaseSymbol}](https://${platform}/address/${contractBaseToken})** to: \n\n{
      governor: [${governor}](https://${platform}/address/${tupleList[0]}),
      pauseGuardian: [${pauseGuardian}](https://${platform}/address/${tupleList[1]}),
      baseToken: [${baseSymbol}](https://${platform}/address/${tupleList[2]}),
      baseTokenPriceFeed: [PriceFeed](https://${platform}/address/${tupleList[3]}),
      extensionDelegate: [${extensionDelegateSymbol}](https://${platform}/address/${tupleList[4]}),
      supplyKink: ${supplyKink.toFixed(2)},
      supplyPerYearInterestRateSlopeLow: ${supplyPerYearInterestRateSlopeLow.toFixed(4)},
      supplyPerYearInterestRateSlopeHigh: ${supplyPerYearInterestRateSlopeHigh.toFixed(4)},
      supplyPerYearInterestRateBase: ${supplyPerYearInterestRateBase.toFixed(4)},
      borrowKink: ${borrowKink.toFixed(2)},
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
}
