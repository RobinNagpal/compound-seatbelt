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
    const prevBorrowPerSecondInterestRateBase = annualize(
      await currentCometInstance.callStatic.borrowPerSecondInterestRateBase()
    )

    // const prevBorrowPerYearInterestRateBase: BigNumber = prevBorrowPerSecondInterestRateBase.mul(secondsPerYear)
    const previousBaseRateInPercent = prevBorrowPerSecondInterestRateBase * 100
    console.log(`Previous BorrowPerYearInterestRateBase ${previousBaseRateInPercent}`)

    const newBorrowPerYearInterestRateBase = BigInt(decodedParams[1])
    const baseRateInPercent = defactor(newBorrowPerYearInterestRateBase) * 100
    console.log(`New BorrowPerYearInterestRateBase: ${baseRateInPercent}`)

    return `Set BorrowPerYearInterestRateBase of [${symbol}](https://etherscan.io/address/${baseToken}) to ${baseRateInPercent}%. Previous value was ${previousBaseRateInPercent}%`
  },
  'setBorrowPerYearInterestRateSlopeLow(address,uint64)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    return `**Set Borrow Per Year Interest Rate Slope Low**`
  },
  'setBorrowPerYearInterestRateSlopeHigh(address,uint64)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    return `**Set Borrow Per Year Interest Rate Slope High**`
  },
}
