import { BigNumber } from '@ethersproject/bignumber'
import { Contract } from 'ethers'
import fs from 'fs'
import { CometChains, SymbolAndDecimalsLookupData } from '../compound-types'
import { customProvider } from './../../../utils/clients/ethers'
import { getContractNameAndAbiFromFile } from './../abi-utils'

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

export function defactor(f: bigint | BigNumber, decimals: number = 1e18): number {
  return Number(toBigInt(f)) / decimals
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

export function calculateDifferenceOfDecimals(num1: number, num2: number): number {
  return defactor(factor(num1) - factor(num2))
}

export async function getPlatform(chain: CometChains) {
  switch (chain) {
    case CometChains.mainnet:
      return 'etherscan.io'
    case CometChains.polygon:
      return 'polygonscan.com'
    case CometChains.arbitrum:
      return 'arbiscan.io'
    case CometChains.base:
      return 'basescan.org'
  }
}

export async function getContractSymbolAndDecimalsFromFile(address: string, instance: Contract, chain: CometChains) {
  const addr = address.toLowerCase()
  let lookupData: SymbolAndDecimalsLookupData = {}

  const filePath = `./checks/compound/erc20/${chain}ERC20InfoLookup.json`
  if (fs.existsSync(filePath)) {
    const fileContent = fs.readFileSync(filePath, 'utf-8')
    lookupData = JSON.parse(fileContent || '{}')
  }

  lookupData[addr] ||= {
    symbol: await instance.callStatic.symbol(),
    decimals: Number(await instance.callStatic.decimals()).toString(),
  }

  fs.writeFileSync(filePath, JSON.stringify(lookupData, null, 2), 'utf-8')

  return { symbol: lookupData[addr].symbol, decimals: lookupData[addr].decimals }
}

export function getPercentageForTokenFactor(value: BigNumber | string) {
  return (defactor(BigInt(value.toString())) * 100).toFixed(1)
}

export function getFormatCompTokens(numberOfCompTokens: string) {
  const compToken = defactor(BigInt(numberOfCompTokens))
  return compToken.toFixed(2)
}

export async function getFormattedTokenWithLink(chain: CometChains, tokenAddress: string, value: string) {
  const platform = await getPlatform(chain)
  const { abi: compAddressAbi } = await getContractNameAndAbiFromFile(chain, tokenAddress)
  const compInstance = new Contract(tokenAddress, compAddressAbi, customProvider(chain))
  const { symbol } = await getContractSymbolAndDecimalsFromFile(tokenAddress, compInstance, chain)
  const token = defactor(BigInt(value))

  return `**${token.toFixed(2)} [${symbol}](https://${platform}/address/${tokenAddress})**`
}
