import dotenv from 'dotenv'
dotenv.config()

import { Contract, ethers } from 'ethers'
import fs from 'fs'
import mftch from 'micro-ftch'
import { CometChains, GovernanceFlows, SymbolAndDecimalsLookupData } from '../compound-types'
import { customProvider } from './../../../utils/clients/ethers'
import { defactorFn } from './../../../utils/roundingUtils'
import { getContractNameAndAbiFromFile } from './../abi-utils'

// @ts-ignore
const fetchUrl = mftch.default

const markets = ['Comet']
export const tab = '    '

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
    case CometChains.scroll:
      return 'scrollscan.com'
    case CometChains.optimism:
      return 'optimistic.etherscan.io'
    case CometChains.mantle:
      return 'mantlescan.xyz'
    case CometChains.unichain:
      return 'uniscan.xyz'
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
    case CometChains.scroll:
      return 'scroll'
    case CometChains.optimism:
      return 'optimistic-ethereum'
    case CometChains.mantle:
      return 'mantle'
    case CometChains.unichain:
      return 'unichain'
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

export async function getFormattedTokenWithLink(chain: CometChains, tokenAddress: string, value: string) {
  return `**${addCommas(value)} ${await getFormattedTokenNameWithLink(chain, tokenAddress)}**`
}

export async function getFormattedTokenNameWithLink(chain: CometChains, tokenAddress: string) {
  const platform = getPlatform(chain)
  const { abi: compAddressAbi } = await getContractNameAndAbiFromFile(chain, tokenAddress)
  if (compAddressAbi.toString() === 'Contract source code not verified') {
    console.log(`Contract at address ${tokenAddress} is not verified.`)
    return `**[Unverified Contract](https://${platform}/address/${tokenAddress})**`
  }

  const compInstance = new Contract(tokenAddress, compAddressAbi, customProvider(chain))
  const { symbol } = await getContractSymbolAndDecimalsFromFile(tokenAddress, compInstance, chain)

  return `**[${symbol}](https://${platform}/address/${tokenAddress})**`
}

async function getSymbolFromAbi(address: string, abi: any[], chain: CometChains) {
  const marketInstance = new Contract(address, abi, customProvider(chain))
  const baseToken = await marketInstance.callStatic.baseToken()
  const { abi: baseTokenAbi } = await getContractNameAndAbiFromFile(chain, baseToken)
  const baseTokenInstance = new Contract(baseToken, baseTokenAbi, customProvider(chain))
  const { symbol } = await getContractSymbolAndDecimalsFromFile(baseToken, baseTokenInstance, chain)
  return symbol
}

export async function getRecipientNameWithLink(chain: CometChains, recipient: string) {
  let recipientName = recipient
  const targetLookupFilePath = `./checks/compound/lookup/recipient/${chain}RecipientLookup.json`
  if (fs.existsSync(targetLookupFilePath)) {
    const fileContent = fs.readFileSync(targetLookupFilePath, 'utf-8')
    const lookupData = JSON.parse(fileContent || '{}')
    recipientName = lookupData[recipient.toLowerCase()] || recipient
  }
  if (recipientName === recipient) {
    const { abi, contractName } = await getContractNameAndAbiFromFile(chain, recipient)

    recipientName = markets.includes(contractName) ? `${contractName} - ${await getSymbolFromAbi(recipient, abi, chain)}` : recipient
  }
  const platform = getPlatform(chain)

  return `**[${recipientName}](https://${platform}/address/${recipient})**`
}

export async function getContractNameWithLink(address: string, chain: CometChains) {
  const { contractName: targetContractName } = await getContractNameAndAbiFromFile(chain, address)
  return `**${addressFormatter(address, chain, targetContractName)}**`
}

export function addressFormatter(address: string, chain: CometChains, symbol?: string) {
  const platform = getPlatform(chain)
  return `[${symbol ?? address}](https://${platform}/address/${address})`
}

export function getChangeTextFn(
  change: string,
  isPercentage: boolean = false,
  thresholds?: { warningThreshold?: number; criticalThreshold?: number },
  criticalityChange?: string,
): string {
  const percentageSign = isPercentage ? '%' : ''
  const isNegative = change.startsWith('-')
  const absoluteChange = isNegative ? change.substring(1) : change

  // Use the criticality change for sign if provided
  const criticalitySign =
    thresholds?.warningThreshold !== undefined && thresholds?.criticalThreshold !== undefined
      ? getCriticalitySign(criticalityChange ?? change, {
          warningThreshold: thresholds.warningThreshold,
          criticalThreshold: thresholds.criticalThreshold,
        })
      : ''

  return `${
    change === '0'
      ? `(It remains the same)`
      : `(It's getting ${change.startsWith('-') ? '**decreased**' : '**increased**'} by **${addCommas(absoluteChange)}${percentageSign}** ${criticalitySign})`
  } `
}

export function formatTimestamp(timestampString: string) {
  const timestamp = parseInt(timestampString)
  return `${new Date(timestamp * 1000).toLocaleString('en-US', {
    timeZone: 'America/New_York',
  })} ET`
}

export function getAttentionSign(
  changeInString: string,
  { warningThreshold, criticalThreshold }: { warningThreshold: number; criticalThreshold: number },
): string {
  const change = Math.abs(parseFloat(changeInString))

  if (change >= warningThreshold || change >= criticalThreshold) {
    return getIcon(IconType.Attention)
  }
  return getIcon(IconType.Update)
}

export function getCriticalitySign(
  changeInString: string,
  { warningThreshold, criticalThreshold }: { warningThreshold: number; criticalThreshold: number },
): string {
  const change = Math.abs(parseFloat(changeInString))

  if (change >= criticalThreshold) {
    return getIcon(IconType.AboveThreshold)
  } else if (change >= warningThreshold) {
    return getIcon(IconType.AroundThreshold)
  }
  return getIcon(IconType.WithinThreshold)
}

export async function fetchAssetIdFromCoinGeckoForSymbol(symbol: string) {
  const baseUrl = 'https://api.coingecko.com/api/v3/search?query='

  try {
    const response = (await fetchUrl(`${baseUrl}${encodeURIComponent(symbol)}`)) as { coins: { id: string; symbol: string }[] }
    if (!response) {
      return null
    }

    if (response.coins && response.coins.length > 0) {
      const token = response.coins.find((c) => c.symbol.toLowerCase() === symbol.toLowerCase())

      return token ? token.id : response.coins[0].id
    } else {
      return null
    }
  } catch (error) {
    console.error('Error fetching ID from Gecko API:', error)
    return null
  }
}

export async function fetchDataForAsset(query: string) {
  try {
    const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(query)}`
    console.log('Fetching data for Coin from Gecko API:', url)
    return await fetchUrl(url)
  } catch (error) {
    console.error('Error fetching data for Coin from Gecko API:', error)
    return null
  }
}

export async function fetchAssetPrice(chain: CometChains, address: string): Promise<number | null> {
  const platform = getPlatformFromGecko(chain)
  const url = `https://api.coingecko.com/api/v3/simple/token_price/${platform}?contract_addresses=${address}&vs_currencies=usd`

  console.log('Fetching data for Coin from Gecko API:', url)

  try {
    const response = await fetchUrl(url)
    if (!response || Object.keys(response).length === 0 || !response[address.toLowerCase()]) {
      console.error('Empty response from Coin Gecko API')
      return null
    }

    return response[address.toLowerCase()].usd
  } catch (error: any) {
    // Check if the response indicates rate limiting
    if (error?.statusCode === 429) {
      // Coin Gecko rate limit is 5 per minute
      console.warn('Coin Gecko rate limit exceeded. Retrying after 1 minute...')
      await delay(70000) // Wait for 1 minute and 10 seconds (10 sec as buffer)
      return fetchAssetPrice(chain, address) // Retry the request
    }
    console.error('Error fetching data for Coin from Gecko API:', error)
    return null
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function addCommas(number: string | number): string {
  if (number === null || number === undefined) return '-'

  const numberAsString = number.toString()
  const isNegative = numberAsString.startsWith('-')

  let absNumberAsString = isNegative ? numberAsString.substring(1) : numberAsString

  let parts = absNumberAsString.split('.')
  let integerPart = parts[0]
  let decimalPart = parts.length > 1 ? '.' + parts[1] : ''

  let reversedIntegerPart = integerPart.split('').reverse().join('')
  let withCommasArray = reversedIntegerPart.match(/.{1,3}/g)
  let withCommas = withCommasArray ? withCommasArray.join(',') : ''

  let formattedNumber = withCommas.split('').reverse().join('') + decimalPart

  return isNegative ? '-' + formattedNumber : formattedNumber
}

export async function formatCoinsAndAmounts(list: string[], chain: CometChains) {
  const platform = getPlatform(chain)
  async function processPair(address: string, amount: string) {
    const { abi } = await getContractNameAndAbiFromFile(chain, address)
    const tokenInstance = new Contract(address, abi, customProvider(chain))
    const { symbol, decimals } = await getContractSymbolAndDecimalsFromFile(address, tokenInstance, chain)
    const defactoredAmount = defactorFn(amount, `${decimals}`)
    return `**${addCommas(defactoredAmount)} [${symbol}](https://${platform}/address/${address})**`
  }
  const promises = []
  for (let i = 0; i < list.length; i += 2) {
    const address = list[i]
    const amount = list[i + 1]
    promises.push(processPair(address, amount))
  }
  const results = await Promise.all(promises)
  return results.join(', ')
}

export function checkforumPost(text: string, proposalID: string) {
  const urlRegex = /https:\/\/www\.comp\.xyz\/t\/[^\s\)]+/g

  const matches = text.match(urlRegex)
  let forumPost = ''
  if (matches && matches.length > 0) {
    forumPost = `Forum post for Proposal # ${proposalID} is present here: [Forum Post](${matches[0]})`
  } else {
    forumPost = 'No forum post is present.'
  }
  // await postNotificationToDiscord(forumPost)
  return forumPost
}

export function formatAddressesAndAmounts(addressesList: string[], amountsList: string[], platform: string) {
  const results = []
  for (let i = 0; i < addressesList.length; i += 1) {
    results.push(`* [${addressesList[i]}](https://${platform}/address/${addressesList[i]}) by ${addCommas(defactorFn(amountsList[i]))} COMP`)
  }
  return results.join('\n\n')
}

export enum IconType {
  Add = 'add',
  Delete = 'delete',
  Convert = 'convert',
  Execute = 'execute',
  Pause = 'pause',
  Unpause = 'unpause',
  Update = 'update',
  Money = 'money',
  Bridge = 'bridge',
  Attention = 'attention',
  WithinThreshold = 'withinThreshold',
  AroundThreshold = 'aroundThreshold',
  AboveThreshold = 'aboveThreshold',
}

export const iconLookupTable: Record<IconType, { icon: string; description: string }> = {
  add: { icon: '➕', description: 'Add or create operation' },
  delete: { icon: '🚮', description: 'Delete or remove operation' },
  convert: { icon: '🔄', description: 'Convert or swap assets operation' },
  execute: { icon: '🚀', description: 'Execute an action or call' },
  pause: { icon: '⏸️', description: 'Pause or stop operation' },
  unpause: { icon: '▶️', description: 'Unpause or resume operation' },
  update: { icon: '🛠️', description: 'Update or change operation' },
  money: { icon: '💵', description: 'Money related operation' },
  bridge: { icon: '🪜', description: 'Bridge assets between networks' },
  attention: { icon: '⚠️', description: 'Requires attention or review' },
  withinThreshold: { icon: '🟢', description: 'Value is within the acceptable threshold' },
  aroundThreshold: { icon: '🟡', description: 'Value slightly above the threshold' },
  aboveThreshold: { icon: '🔴', description: 'Value critically above the threshold' },
}

export function getIcon(keyword: IconType) {
  const result = iconLookupTable[keyword]
  return result.icon
}

export function capitalizeWord(word: string) {
  return word.charAt(0).toUpperCase() + word.slice(1)
}

export function getFlowText(flow: GovernanceFlows, mainFlowText: string, marketFlowText: string) {
  return flow === GovernanceFlows.main ? mainFlowText : marketFlowText
}
