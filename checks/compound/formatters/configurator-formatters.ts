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
    console.log(`decodedParams ${decodedParams.join(',')}`)
    const platform = await getPlatform(chain)

    const { abi } = await getContractNameAndAbiFromFile(chain, decodedParams[0])
    const currentCometInstance = new Contract(decodedParams[0], abi, customProvider(chain))

    const baseToken = await currentCometInstance.callStatic.baseToken()
    const { abi: baseTokenAbi } = await getContractNameAndAbiFromFile(chain, baseToken)
    const baseTokenInstance = new Contract(baseToken, baseTokenAbi, customProvider(chain))
    const { symbol } = await getContractSymbolAndDecimalsFromFile(baseToken, baseTokenInstance, chain)

    const prevBorrowSpeed = defactor(await currentCometInstance.callStatic.baseTrackingBorrowSpeed())
    console.log(`Previous BaseTrackingBorrowSpeed: ${prevBorrowSpeed}`)

    const newBorrowSpeed = defactor(BigInt(decodedParams[1]))
    console.log(`New BaseTrackingBorrowSpeed: ${newBorrowSpeed}`)

    const changeInSpeed = calculateDifferenceOfDecimals(newBorrowSpeed, prevBorrowSpeed)

    return `\n\nSet BaseTrackingBorrowSpeed of [${symbol}](https://${platform}/address/${baseToken}) to ${newBorrowSpeed}. Previous value was ${prevBorrowSpeed} and now it is getting ${
      changeInSpeed > 0 ? 'increased' : 'decreased'
    } by **${changeInSpeed}**`
  },
  'setBaseTrackingSupplySpeed(address,uint64)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    console.log(`decodedParams ${decodedParams.join(',')}`)
    const platform = await getPlatform(chain)

    const { abi } = await getContractNameAndAbiFromFile(chain, decodedParams[0])
    const currentCometInstance = new Contract(decodedParams[0], abi, customProvider(chain))

    const baseToken = await currentCometInstance.callStatic.baseToken()
    const { abi: baseTokenAbi } = await getContractNameAndAbiFromFile(chain, baseToken)
    const baseTokenInstance = new Contract(baseToken, baseTokenAbi, customProvider(chain))
    const { symbol } = await getContractSymbolAndDecimalsFromFile(baseToken, baseTokenInstance, chain)

    const prevSupplySpeed = defactor(await currentCometInstance.callStatic.baseTrackingSupplySpeed())
    console.log(`Previous BaseTrackingBorrowSpeed: ${prevSupplySpeed}`)

    const newSupplySpeed = defactor(BigInt(decodedParams[1]))
    console.log(`New BaseTrackingBorrowSpeed: ${newSupplySpeed}`)

    const changeInSpeed = calculateDifferenceOfDecimals(newSupplySpeed, prevSupplySpeed)

    return `\n\nSet BaseTrackingSupplySpeed of [${symbol}](https://${platform}/address/${baseToken}) to ${newSupplySpeed}. Previous value was ${prevSupplySpeed} and now it is getting ${
      changeInSpeed > 0 ? 'increased' : 'decreased'
    } by **${changeInSpeed}**`
  },
  'setBorrowKink(address,uint64)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    console.log(`decodedParams ${decodedParams.join(',')}`)
    const platform = await getPlatform(chain)

    const { abi } = await getContractNameAndAbiFromFile(chain, decodedParams[0])

    const currentCometInstance = new Contract(decodedParams[0], abi, customProvider(chain))
    // console.log('current comet instance', currentCometInstance)
    console.log('chain', chain)
    const baseToken = await currentCometInstance.callStatic.baseToken()
    console.log('baseToken', baseToken)
    const { abi: baseTokenAbi } = await getContractNameAndAbiFromFile(chain, baseToken)
    const baseTokenInstance = new Contract(baseToken, baseTokenAbi, customProvider(chain))
    const { symbol } = await getContractSymbolAndDecimalsFromFile(baseToken, baseTokenInstance, chain)

    const prevBorrowKink = defactor(await currentCometInstance.callStatic.borrowKink())
    console.log(`Previous BorrowKink: ${prevBorrowKink}`)

    const newBorrowKink = defactor(BigInt(decodedParams[1]))
    console.log(`New BorrowKink: ${newBorrowKink}`)

    const changeInKink = calculateDifferenceOfDecimals(newBorrowKink, prevBorrowKink)

    return `\n\nSet BorrowKink of [${symbol}](https://${platform}/address/${baseToken}) to ${newBorrowKink}. Previous value was ${prevBorrowKink} and now it is getting ${
      changeInKink > 0 ? 'increased' : 'decreased'
    } by **${changeInKink}**`
  },
  'setSupplyKink(address,uint64)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    console.log(`decodedParams ${decodedParams.join(',')}`)
    const platform = await getPlatform(chain)

    const { abi } = await getContractNameAndAbiFromFile(chain, decodedParams[0])
    const currentCometInstance = new Contract(decodedParams[0], abi, customProvider(chain))

    const baseToken = await currentCometInstance.callStatic.baseToken()
    const { abi: baseTokenAbi } = await getContractNameAndAbiFromFile(chain, baseToken)
    const baseTokenInstance = new Contract(baseToken, baseTokenAbi, customProvider(chain))
    const { symbol } = await getContractSymbolAndDecimalsFromFile(baseToken, baseTokenInstance, chain)

    const prevSupplyKink = defactor(await currentCometInstance.callStatic.supplyKink())
    console.log(`Previous SupplyKink: ${prevSupplyKink}`)

    const newSupplyKink = defactor(BigInt(decodedParams[1]))
    console.log(`New SupplyKink: ${newSupplyKink}`)

    const changeInKink = calculateDifferenceOfDecimals(newSupplyKink, prevSupplyKink)

    return `\n\nSet SupplyKink of [${symbol}](https://${platform}/address/${baseToken}) to ${newSupplyKink}. Previous value was ${prevSupplyKink} and now it is getting ${
      changeInKink > 0 ? 'increased' : 'decreased'
    } by **${changeInKink}**`
  },
}
