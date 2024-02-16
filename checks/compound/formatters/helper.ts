import { BigNumber } from '@ethersproject/bignumber'
import { Contract, ethers } from 'ethers'
import fs from 'fs'
import { CometChains, SymbolAndDecimalsLookupData } from '../compound-types'
import { customProvider } from './../../../utils/clients/ethers'
import { getContractNameAndAbiFromFile } from './../abi-utils'
import mftch from 'micro-ftch'
// @ts-ignore
const fetchUrl = mftch.default

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

export function calculateDifferenceOfDecimals(newValue: number, oldValue: number): number {
  return defactor(factor(newValue) - factor(oldValue))
}

export function getPlatform(chain: CometChains) {
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

export function getPlatformFromGecko(chain: CometChains) {
  switch (chain) {
    case CometChains.mainnet:
      return 'ethereum'
    case CometChains.polygon:
      return 'polygon-pos'
    case CometChains.arbitrum:
      return 'arbitrum-one'
    case CometChains.base:
      return 'base'
  }
}

async function getSymbol(instance: Contract) {
  const symbol = await instance.callStatic.symbol()

  if (symbol.length === 66 && symbol.slice(0, 2) === '0x') {
    return ethers.utils.parseBytes32String(symbol)
  } else {
    return symbol
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
    symbol: await getSymbol(instance),
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
  const token = defactor(BigInt(value))
  return `**${token.toFixed(2)} ${await getFormattedTokenNameWithLink(chain, tokenAddress)}**`
}
export async function getFormattedTokenNameWithLink(chain: CometChains, tokenAddress: string) {
  const platform = await getPlatform(chain)
  const { abi: compAddressAbi } = await getContractNameAndAbiFromFile(chain, tokenAddress)
  const compInstance = new Contract(tokenAddress, compAddressAbi, customProvider(chain))
  const { symbol } = await getContractSymbolAndDecimalsFromFile(tokenAddress, compInstance, chain)

  return `[${symbol}](https://${platform}/address/${tokenAddress})`
}

export function getRecipientNameWithLink(chain: CometChains, recipient: string) {
  let recipientName = recipient
  const targetLookupFilePath = `./checks/compound/lookup/recipient/${chain}RecipientLookup.json`
  if (fs.existsSync(targetLookupFilePath)) {
    const fileContent = fs.readFileSync(targetLookupFilePath, 'utf-8')
    const lookupData = JSON.parse(fileContent || '{}')
    recipientName = lookupData[recipient.toLowerCase()] || recipient
  }
  const platform = getPlatform(chain)

  return `[${recipientName}](https://${platform}/address/${recipient})`
}

export function getChangeText(change: number, isPercentage: boolean = false): string {
  const percentageSign = isPercentage ? '%' : ''
  return `${
    change == 0
      ? `(It remains the same)`
      : `(It's getting ${change > 0 ? 'increased' : 'decreased'} by **${change}${percentageSign}**)`
  } `
}

export function formatTimestamp(timestampString: string) {
  const timestamp = parseInt(timestampString)
  const date = new Date(timestamp * 1000)
  return date.toLocaleString()
}

export function getCriticalitySign(change: number, optimumChange: number) {
  if (change <= -2 * optimumChange || change >= 2 * optimumChange) {
    return '🛑'
  } else if (change <= -optimumChange || change >= optimumChange) {
    return '⚠️'
  } else {
    return ''
  }
}

export async function fetchIdFromGecko(query: string) {
  const baseUrl = 'https://api.coingecko.com/api/v3/search?query='

  try {
    const response = await fetchUrl(`${baseUrl}${encodeURIComponent(query)}`)
    console.log('response', response)
    if (!response) {
      return null
    }

    if (response.coins && response.coins.length > 0) {
      return response.coins[0].id
    } else {
      return null
    }
  } catch (error) {
    console.error('Error fetching ID from Gecko API:', error)
    return null
  }
}

export async function fetchDataForAsset(query: string) {
  const baseUrl = 'https://api.coingecko.com/api/v3/coins/'

  try {
    const response = await fetchUrl(`${baseUrl}${encodeURIComponent(query)}`)
    if (!response) {
      return null
    }
    return response
  } catch (error) {
    console.error('Error fetching data for Coin from Gecko API:', error)
    return null
  }
}
