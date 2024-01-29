import { BigNumber } from '@ethersproject/bignumber'

export type Numeric = number | bigint
export const factorDecimals = 18
export const factorScale = factor(1)
export const ONE = factorScale
export const ZERO = factor(0)
export function exp(i: number, d: Numeric = 0, r: Numeric = 6): bigint {
  return (BigInt(Math.floor(i * 10 ** Number(r))) * 10n ** BigInt(d)) / 10n ** BigInt(r)
}

export function factor(f: number, decimals: number = factorDecimals): bigint {
  return exp(f, decimals)
}

export function defactor(f: bigint | BigNumber): number {
  return Number(toBigInt(f)) / 1e18
}

// Truncates a factor to a certain number of decimals
export function truncateDecimals(factor: bigint | BigNumber, decimals = 4) {
  const descaleFactor = factorScale / exp(1, decimals)
  return (toBigInt(factor) / descaleFactor) * descaleFactor
}

export function mulPrice(n: bigint, price: bigint | BigNumber, fromScale: bigint | BigNumber): bigint {
  return (n * toBigInt(price)) / toBigInt(fromScale)
}

function toBigInt(f: bigint | BigNumber): bigint {
  if (typeof f === 'bigint') {
    return f
  } else {
    return f.toBigInt()
  }
}

export function annualize(n: bigint | BigNumber, secondsPerYear = 31536000n): number {
  return defactor(toBigInt(n) * secondsPerYear)
}

export function toYears(seconds: number, secondsPerYear = 31536000): number {
  return seconds / secondsPerYear
}

export function subtract(num1: number, num2: number): number {
  return defactor(factor(num1) - factor(num2))
}
