import { BigNumber } from '@ethersproject/bignumber'
import { defactor, factor, factorDecimals } from './checks/compound/formatters/helper'

function defactorFn(f: bigint | BigNumber, decimals: number = 1e18): number {
  return defactor(f, decimals)
}

function factorFn(f: number, decimals: number = factorDecimals): bigint {
  return factor(f, decimals)
}

async function main() {
  const number1 = '350000000000000000'
  const number2 = '500000000000000000'
  const number3 = '550000000000000000'
  console.log('defactor 1', defactorFn(BigInt(number1)))
  console.log('defactor 2', defactorFn(BigInt(number2)))
  console.log('defactor 3', defactorFn(BigInt(number3)))

  const diffNumber1 = 350000000000000001
  const diffNumber2 = 350000000000000002
  const diffNumber3 = 350000000000000004

  console.log('difference 1', defactorFn(BigInt(number1)) - defactorFn(BigInt(diffNumber1)))
  console.log('difference 2', defactorFn(BigInt(number2)) - defactorFn(BigInt(diffNumber2)))
  console.log('difference 3', defactorFn(BigInt(number3)) - defactorFn(BigInt(diffNumber3)))
}

main()
