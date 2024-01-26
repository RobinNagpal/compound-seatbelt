import { getContractNameAndAbiFromFile } from './../abi-utils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from './../compound-types'
import { BigNumber } from '@ethersproject/bignumber'
import { constants, Contract } from 'ethers'
import { provider } from '../../../utils/clients/ethers'

export const configuratorFormatters: { [functionName: string]: TransactionFormatter } = {
  'setBorrowPerYearInterestRateBase(address,uint64)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[],
  ) => {
    const secondsPerYear = 60 * 60 * 24 * 365 //seconds * minutes * hours * days
    const divisor = constants.WeiPerEther

    const { abi } = await getContractNameAndAbiFromFile(chain, decodedParams[0])
    const governance = new Contract(decodedParams[0], abi, provider)

    const prevBorrowPerSecondInterestRateBase = BigNumber.from(
      await governance.callStatic.borrowPerSecondInterestRateBase(),
    )

    const prevBorrowPerYearInterestRateBase: BigNumber = prevBorrowPerSecondInterestRateBase.mul(secondsPerYear)
    console.log(`Previous BorrowPerYearInterestRateBase ${prevBorrowPerYearInterestRateBase}`)

    const newBorrowPerYearInterestRateBase: BigNumber = BigNumber.from(decodedParams[1])
    console.log(`New BorrowPerYearInterestRateBase: ${newBorrowPerYearInterestRateBase}`)

    const subtraction = newBorrowPerYearInterestRateBase.sub(prevBorrowPerYearInterestRateBase)
    const changeIntegerPart = subtraction.div(divisor)
    const changeRemainderPart = subtraction.mod(divisor)
    const changeFractionalPart = changeRemainderPart.toString().padStart(18, '0')
    const changeFinalResult = `${changeIntegerPart}.${changeFractionalPart}`
    // console.log(
    //   `${changeFinalResult.startsWith('-') ? 'Decrease' : 'Increase'} in Interest Rate Base: ${changeFinalResult}`
    // )

    console.log(`Change in Interest Rate Base: ${changeFinalResult}`)
    console.log(
      `${
        subtraction.toString().startsWith('-') ? 'Decrease' : 'Increase'
      } in Interest Rate Base: ${subtraction.toString()}`,
    )

    const percentage = subtraction.mul(100)
    const percentageIntegralPart = percentage.div(prevBorrowPerYearInterestRateBase)
    const percentageRemainderPart = percentage.mod(prevBorrowPerYearInterestRateBase)
    const percentageFractionalPart = percentageRemainderPart.toString().padStart(18, '0')
    const percentageResult = `${percentageIntegralPart}.${percentageFractionalPart}`
    return `Percentage change in Interest Rate Base: ${percentageResult} %`
  },
  'setBorrowPerYearInterestRateSlopeLow(address,uint64)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[],
  ) => {
    return `**Set Borrow Per Year Interest Rate Slope Low**`
  },
  'setBorrowPerYearInterestRateSlopeHigh(address,uint64)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[],
  ) => {
    return `**Set Borrow Per Year Interest Rate Slope High**`
  },
}
