import { Contract } from 'ethers'
import { provider } from '../../../utils/clients/ethers'
import { getContractNameAndAbiFromFile } from './../abi-utils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from './../compound-types'
import { annualize, defactor } from './helper'

export const configuratorFormatters: { [functionName: string]: TransactionFormatter } = {
  'setBorrowPerYearInterestRateBase(address,uint64)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    console.log(`decodedParams ${decodedParams.join(',')}`)

    const { abi } = await getContractNameAndAbiFromFile(chain, decodedParams[0])
    const currentCometInstance = new Contract(decodedParams[0], abi, provider)

    const baseToken = await currentCometInstance.callStatic.baseToken()
    const { abi: baseTokenAbi } = await getContractNameAndAbiFromFile(chain, baseToken)
    const baseTokenInstance = new Contract(baseToken, baseTokenAbi, provider)
    const symbol = await baseTokenInstance.callStatic.symbol()
    const prevBorrowPerYearInterestRateBase = annualize(
      await currentCometInstance.callStatic.borrowPerSecondInterestRateBase()
    )

    const previousBaseRateInPercent = prevBorrowPerYearInterestRateBase * 100
    console.log(`Previous BorrowPerYearInterestRateBase ${previousBaseRateInPercent}`)

    const newBorrowPerYearInterestRateBase = BigInt(decodedParams[1])
    const currentBaseRateInPercent = defactor(newBorrowPerYearInterestRateBase) * 100
    console.log(`New BorrowPerYearInterestRateBase: ${currentBaseRateInPercent}`)

    const changeInBaseRate = currentBaseRateInPercent - previousBaseRateInPercent

    return `Set BorrowPerYearInterestRateBase of [${symbol}](https://etherscan.io/address/${baseToken}) to ${currentBaseRateInPercent}%. Previous value was ${previousBaseRateInPercent}% and now it is getting ${
      changeInBaseRate > 0 ? 'increased' : 'decreased'
    } by **${changeInBaseRate}%**`
  },
  'setBorrowPerYearInterestRateSlopeLow(address,uint64)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    console.log(`decodedParams ${decodedParams.join(',')}`)

    const { abi } = await getContractNameAndAbiFromFile(chain, decodedParams[0])
    const currentCometInstance = new Contract(decodedParams[0], abi, provider)

    const baseToken = await currentCometInstance.callStatic.baseToken()
    const { abi: baseTokenAbi } = await getContractNameAndAbiFromFile(chain, baseToken)
    const baseTokenInstance = new Contract(baseToken, baseTokenAbi, provider)
    const symbol = await baseTokenInstance.callStatic.symbol()
    const prevBorrowPerYearInterestRateSlopeLow = annualize(
      await currentCometInstance.callStatic.borrowPerSecondInterestRateSlopeLow()
    )

    const previousSlopeLowInPercent = prevBorrowPerYearInterestRateSlopeLow * 100
    console.log(`Previous BorrowPerYearInterestRateSlopeLow ${previousSlopeLowInPercent}`)

    const newBorrowPerYearInterestRateSlopeLow = BigInt(decodedParams[1])
    const currentSlopeLowInPercent = defactor(newBorrowPerYearInterestRateSlopeLow) * 100
    console.log(`New BorrowPerYearInterestRateSlopeLow: ${currentSlopeLowInPercent}`)

    const changeInSlopeLow = currentSlopeLowInPercent - previousSlopeLowInPercent

    return `Set Borrow Per Year Interest Rate Slope Low [${symbol}](https://etherscan.io/address/${baseToken}) to ${currentSlopeLowInPercent}%. Previous value was ${previousSlopeLowInPercent}% and now it is getting ${
      changeInSlopeLow > 0 ? 'increased' : 'decreased'
    } by **${changeInSlopeLow}%**`
  },
  'setBorrowPerYearInterestRateSlopeHigh(address,uint64)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    console.log(`decodedParams ${decodedParams.join(',')}`)

    const { abi } = await getContractNameAndAbiFromFile(chain, decodedParams[0])
    const currentCometInstance = new Contract(decodedParams[0], abi, provider)

    const baseToken = await currentCometInstance.callStatic.baseToken()
    const { abi: baseTokenAbi } = await getContractNameAndAbiFromFile(chain, baseToken)
    const baseTokenInstance = new Contract(baseToken, baseTokenAbi, provider)
    const symbol = await baseTokenInstance.callStatic.symbol()
    const prevBorrowPerYearInterestRateSlopeHigh = annualize(
      await currentCometInstance.callStatic.borrowPerSecondInterestRateSlopeHigh()
    )

    const previousSlopeHighInPercent = prevBorrowPerYearInterestRateSlopeHigh * 100
    console.log(`Previous BorrowPerYearInterestRateSlopeHigh ${previousSlopeHighInPercent}`)

    const newBorrowPerYearInterestRateSlopeHigh = BigInt(decodedParams[1])
    const currentSlopeHighInPercent = defactor(newBorrowPerYearInterestRateSlopeHigh) * 100
    console.log(`New BorrowPerYearInterestRateSlopeHigh: ${currentSlopeHighInPercent}`)

    const changeInSlopeHigh = currentSlopeHighInPercent - previousSlopeHighInPercent

    return `Set Borrow Per Year Interest Rate Slope High [${symbol}](https://etherscan.io/address/${baseToken}) to ${currentSlopeHighInPercent}%. Previous value was ${previousSlopeHighInPercent}% and now it is getting ${
      changeInSlopeHigh > 0 ? 'increased' : 'decreased'
    } by **${changeInSlopeHigh}%**`
  },
  'setSupplyPerYearInterestRateSlopeLow(address,uint64)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    console.log(`decodedParams ${decodedParams.join(',')}`)

    const { abi } = await getContractNameAndAbiFromFile(chain, decodedParams[0])
    const currentCometInstance = new Contract(decodedParams[0], abi, provider)

    const baseToken = await currentCometInstance.callStatic.baseToken()
    const { abi: baseTokenAbi } = await getContractNameAndAbiFromFile(chain, baseToken)
    const baseTokenInstance = new Contract(baseToken, baseTokenAbi, provider)
    const symbol = await baseTokenInstance.callStatic.symbol()
    const prevSupplyPerYearInterestRateSlopeLow = annualize(
      await currentCometInstance.callStatic.supplyPerSecondInterestRateSlopeLow()
    )

    const previousSlopeLowInPercent = prevSupplyPerYearInterestRateSlopeLow * 100
    console.log(`Previous SupplyPerYearInterestRateSlopeLow ${previousSlopeLowInPercent}`)

    const newSupplyPerYearInterestRateSlopeLow = BigInt(decodedParams[1])
    const currentSlopeLowInPercent = defactor(newSupplyPerYearInterestRateSlopeLow) * 100
    console.log(`New SupplyPerYearInterestRateSlopeLow: ${currentSlopeLowInPercent}`)

    const changeInSlopeLow = currentSlopeLowInPercent - previousSlopeLowInPercent

    return `Set Supply Per Year Interest Rate Slope Low [${symbol}](https://etherscan.io/address/${baseToken}) to ${currentSlopeLowInPercent}%. Previous value was ${previousSlopeLowInPercent}% and now it is getting ${
      changeInSlopeLow > 0 ? 'increased' : 'decreased'
    } by **${changeInSlopeLow}%**`
  },
  'setSupplyPerYearInterestRateSlopeHigh(address,uint64)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    console.log(`decodedParams ${decodedParams.join(',')}`)

    const { abi } = await getContractNameAndAbiFromFile(chain, decodedParams[0])
    const currentCometInstance = new Contract(decodedParams[0], abi, provider)

    const baseToken = await currentCometInstance.callStatic.baseToken()
    const { abi: baseTokenAbi } = await getContractNameAndAbiFromFile(chain, baseToken)
    const baseTokenInstance = new Contract(baseToken, baseTokenAbi, provider)
    const symbol = await baseTokenInstance.callStatic.symbol()
    const prevSupplyPerYearInterestRateSlopeHigh = annualize(
      await currentCometInstance.callStatic.supplyPerSecondInterestRateSlopeHigh()
    )

    const previousSlopeHighInPercent = prevSupplyPerYearInterestRateSlopeHigh * 100
    console.log(`Previous SupplyPerYearInterestRateSlopeHigh ${previousSlopeHighInPercent}`)

    const newSupplyPerYearInterestRateSlopeHigh = BigInt(decodedParams[1])
    const currentSlopeHighInPercent = defactor(newSupplyPerYearInterestRateSlopeHigh) * 100
    console.log(`New SupplyPerYearInterestRateSlopeHigh: ${currentSlopeHighInPercent}`)

    const changeInSlopeHigh = currentSlopeHighInPercent - previousSlopeHighInPercent

    return `Set Supply Per Year Interest Rate Slope High [${symbol}](https://etherscan.io/address/${baseToken}) to ${currentSlopeHighInPercent}%. Previous value was ${previousSlopeHighInPercent}% and now it is getting ${
      changeInSlopeHigh > 0 ? 'increased' : 'decreased'
    } by **${changeInSlopeHigh}%**`
  },
}
