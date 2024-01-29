import { BigNumber, Contract } from 'ethers'
import { provider } from '../../../utils/clients/ethers'
import { getContractNameAndAbiFromFile } from './../abi-utils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from './../compound-types'
import { annualize, defactor, calculateDifferenceOfDecimals } from './helper'

async function getTextForChangeInInterestRate(
  chain: CometChains,
  decodedParams: string[],
  getInterestRateFunction: (contract: Contract) => Promise<BigNumber>,
  interestRateName: string
) {
  console.log(`decodedParams ${decodedParams.join(',')}`)

  const { abi } = await getContractNameAndAbiFromFile(chain, decodedParams[0])
  const currentCometInstance = new Contract(decodedParams[0], abi, provider)

  const baseToken = await currentCometInstance.callStatic.baseToken()
  const { abi: baseTokenAbi } = await getContractNameAndAbiFromFile(chain, baseToken)
  const baseTokenInstance = new Contract(baseToken, baseTokenAbi, provider)
  const symbol = await baseTokenInstance.callStatic.symbol()

  const prevInterestRate = annualize(await getInterestRateFunction(currentCometInstance))
  const previousRateInPercent = prevInterestRate * 100
  console.log(`Previous ${interestRateName} ${previousRateInPercent}`)

  const newInterestRate = BigInt(decodedParams[1])
  const currentRateInPercent = defactor(newInterestRate) * 100
  console.log(`New ${interestRateName}: ${currentRateInPercent}`)

  const changeInRate = calculateDifferenceOfDecimals(currentRateInPercent, previousRateInPercent)

  return `\nSet ${interestRateName} of [${symbol}](https://etherscan.io/address/${baseToken}) to ${currentRateInPercent}%. Previous value was ${previousRateInPercent}% and now it is getting ${
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
      'BorrowPerYearInterestRateBase'
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
      'BorrowPerYearInterestRateSlopeLow'
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
      'BorrowPerYearInterestRateSlopeHigh'
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
      'SupplyPerYearInterestRateSlopeLow'
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
      'SupplyPerYearInterestRateSlopeHigh'
    )
  },
  'deployAndUpgradeTo(address,address)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    console.log(`decodedParams ${decodedParams.join(',')}`)

    const { contractName } = await getContractNameAndAbiFromFile(chain, decodedParams[0])

    const { abi } = await getContractNameAndAbiFromFile(chain, decodedParams[1])
    const currentCometInstance = new Contract(decodedParams[1], abi, provider)

    const baseToken = await currentCometInstance.callStatic.baseToken()
    const { abi: baseTokenAbi } = await getContractNameAndAbiFromFile(chain, baseToken)
    const baseTokenInstance = new Contract(baseToken, baseTokenAbi, provider)
    const symbol = await baseTokenInstance.callStatic.symbol()

    return `Deploy and upgrade new implementation for [${symbol}](https://etherscan.io/address/${baseToken}) via [${contractName}](https://etherscan.io/address/${decodedParams[0]}).`
  },
}
