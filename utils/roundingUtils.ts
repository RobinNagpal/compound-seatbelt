import { Decimal } from 'decimal.js'
Decimal.set({ precision: 100 })

export function defactorFn(number: string, decimals = '18') {
  return Decimal.div(new Decimal(number), new Decimal(`1e${decimals}`)).toFixed()
}

export function factorFn(base: string, exponent = 18) {
  return Decimal.pow(new Decimal(base), exponent).toFixed()
}

export function subtractFn(number1: string, number2: string) {
  return Decimal.sub(new Decimal(number1), new Decimal(number2)).toFixed()
}

export function addFn(number1: string, number2: string) {
  return Decimal.add(new Decimal(number1), new Decimal(number2)).toFixed()
}

export function multiplyFn(number1: string, number2: string) {
  return Decimal.mul(new Decimal(number1), new Decimal(number2)).toFixed()
}

export function annualizeFn(number: string, secondsPerYear = '31536000') {
  return defactorFn(multiplyFn(number, secondsPerYear))
}

export function toYearsFn(seconds: string, secondsPerYear = '31536000') {
  return Decimal.div(new Decimal(seconds), new Decimal(secondsPerYear)).toFixed()
}

export function percentageFn(value: string) {
  if (value === '0') return '0'
  return defactorFn(Decimal.mul(new Decimal(value), new Decimal(100)).toFixed())
}
