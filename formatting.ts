import { BigNumber } from '@ethersproject/bignumber'
import { defactor, factor, factorDecimals } from './checks/compound/formatters/helper'
import { Decimal } from 'decimal.js'
Decimal.set({ precision: 100 })

function defactorFnD(number: string, decimals = '18') {
  return Decimal.div(new Decimal(number), new Decimal(`1e${decimals}`)).toFixed()
}

function factorFnD(base: string, exponent = 18) {
  return Decimal.pow(new Decimal(base), exponent).toFixed()
}

function subtractFnD(number1: string, number2: string) {
  return Decimal.sub(new Decimal(number1), new Decimal(number2)).toFixed()
}

function addFnD(number1: string, number2: string) {
  return Decimal.add(new Decimal(number1), new Decimal(number2)).toFixed()
}

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

  const diffNumber1 = '350000000000000001'
  const diffNumber2 = '350000000000000002'
  const diffNumber3 = '350000000000000004'

  console.log('difference 1', defactorFn(BigInt(number1)) - defactorFn(BigInt(diffNumber1)))
  console.log('difference 2', defactorFn(BigInt(number2)) - defactorFn(BigInt(diffNumber2)))
  console.log('difference 3', defactorFn(BigInt(number3)) - defactorFn(BigInt(diffNumber3)))

  const bigNumber1 = BigNumber.from(number1).div(1e18)
  const bigNumber2 = BigNumber.from(number2).div(1e18)
  const bigNumber3 = BigNumber.from(number3).div(1e18)

  console.log('BigNumber 1', bigNumber1)
  console.log('BigNumber 2', bigNumber2)
  console.log('BigNumber 3', bigNumber3)

  const bigNumberDiff1 = BigNumber.from(diffNumber1).div(1e18)
  const bigNumberDiff2 = BigNumber.from(diffNumber2).div(1e18)
  const bigNumberDiff3 = BigNumber.from(diffNumber3).div(1e18)

  console.log('difference 1', bigNumber1.sub(bigNumberDiff1).toString())
  console.log('difference 2', bigNumber2.sub(bigNumberDiff2).toString())
  console.log('difference 3', bigNumber3.sub(bigNumberDiff3).toString())
}

function roundingScenariosByD() {
  const number1 = '2210000000000000000000000000'
  const number2 = '2210000000000000000000000000.00000000000000000022'
  const number3 = '0.00000000000000000022'

  console.log('defactor by 18', defactorFnD(number1))
  console.log('defactor by 12', defactorFnD(number1, '12'))
  console.log('defactor by 6', defactorFnD(number1, '6'))

  console.log('subtract num1 & num2', subtractFnD(number1, number2))
  console.log('subtract num1 & num3', subtractFnD(number1, number3))

  console.log('add num1 & num2', addFnD(number1, number2))
  console.log('add num1 & num3', addFnD(number1, number3))
}
roundingScenariosByD()
