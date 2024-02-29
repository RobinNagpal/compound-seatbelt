import dotenv from 'dotenv'
dotenv.config()
import { Contract, ethers } from 'ethers'
import fs from 'fs'
import { CometChains, SymbolAndDecimalsLookupData } from '../compound-types'
import { customProvider } from './../../../utils/clients/ethers'
import { getContractNameAndAbiFromFile } from './../abi-utils'
import { defactorFn } from './../../../utils/roundingUtils'
import { DISCORD_WEBHOOK_URL } from './../../../utils/constants'
import mftch, { FETCH_OPT, InvalidStatusCodeError } from 'micro-ftch'
import { add, commit, push } from 'isomorphic-git'
import http from 'isomorphic-git/http/node'

// @ts-ignore
const fetchUrl = mftch.default

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

export async function getFormattedTokenWithLink(chain: CometChains, tokenAddress: string, value: string) {
  const token = defactorFn(value)
  return `**${addCommas(token)} ${await getFormattedTokenNameWithLink(chain, tokenAddress)}**`
}
export async function getFormattedTokenNameWithLink(chain: CometChains, tokenAddress: string) {
  const platform = getPlatform(chain)
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

export function getChangeTextFn(change: string, isPercentage: boolean = false): string {
  const percentageSign = isPercentage ? '%' : ''
  const absoluteChange = change.startsWith('-') ? change.substring(1) : change
  return `${
    change === '0'
      ? `(It remains the same)`
      : `(It's getting ${change.startsWith('-') ? '**decreased**' : '**increased**'} by **${addCommas(absoluteChange)}${percentageSign}**)`
  } `
}

export function formatTimestamp(timestampString: string) {
  const timestamp = parseInt(timestampString)
  return `${new Date(timestamp * 1000).toLocaleString('en-US', {
    timeZone: 'America/New_York',
  })} ET`
}

export function getCriticalitySign(changeInString: string, optimumChange: number) {
  const change = parseFloat(changeInString)
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

export function addCommas(numberAsString: string): string {
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

export async function formatCoinsAndAmounts(list: string[], chain: CometChains, platform: string) {
  async function processPair(address: string, amount: string) {
    const { abi } = await getContractNameAndAbiFromFile(chain, address)
    const tokenInstance = new Contract(address, abi, customProvider(chain))
    const { symbol, decimals } = await getContractSymbolAndDecimalsFromFile(address, tokenInstance, chain)
    const defactoredAmount = defactorFn(amount, `${decimals}`)
    return `${addCommas(defactoredAmount)} [${symbol}](https://${platform}/address/${address})`
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

export function checkforumPost(text: string) {
  const urlRegex = /https:\/\/www\.comp\.xyz\/t\/[^\s\)]+/g

  const matches = text.match(urlRegex)

  if (matches && matches.length > 0) {
    return `Forum post is present here: [Forum Post](${matches[0]})`
  } else {
    return 'No forum post is present.'
  }
}

export function formatAddressesAndAmounts(addressesList: string[], amountsList: string[], platform: string) {
  const results = []
  for (let i = 0; i < addressesList.length; i += 1) {
    results.push(`* [${addressesList[i]}](https://${platform}/address/${addressesList[i]}) by ${addCommas(defactorFn(amountsList[i]))} COMP`)
  }
  return results.join('\n\n')
}

export async function postNotificationToDiscord(text: string) {
  const message = text.length > 2000 ? 'Text length exceeds 2000 characters' : text

  const fetchOptions = <Partial<FETCH_OPT>>{
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    data: JSON.stringify({ content: message }) as unknown as object,
  }
  try {
    const response = await fetchUrl(DISCORD_WEBHOOK_URL, fetchOptions)
    console.log('Successfully posted summary to Discord.')
  } catch (error) {
    if (error instanceof InvalidStatusCodeError && error.statusCode === 204) {
      console.log('Successfully posted message to Discord.')
    } else {
      console.error('Error posting to Discord:', error)
    }
  }
}

export async function commitAndPushToGit(filePath: string, proposalNo: string) {
  const message = `Add pdf report of Proposal # ${proposalNo} to the repository`
  const author = { name: process.env.GITHUB_USERNAME, email: process.env.GITHUB_EMAIL }
  await add({ fs, dir: `${process.env.GIT_REPO_PATH}`, filepath: `${filePath}` })
  await commit({ fs, dir: `${process.env.GIT_REPO_PATH}`, message, author })
  const pushResult = await push({
    fs,
    http,
    dir: `${process.env.GIT_REPO_PATH}`,
    remote: 'origin',
    ref: 'dawood/workflow_changes',
    onAuth: () => ({ username: process.env.GITHUB_TOKEN }),
  })
  if (pushResult.ok) {
    console.log(`Successfully pushed pdf report of proposal # ${proposalNo} to the repository.`)
    await postNotificationToDiscord(
      `Pdf report of **Proposal # ${proposalNo}** has been added to the repository which can be accessed **[here](${process.env.GITHUB_REPO_PATH}/${filePath})**.\n\n`
    )
  }
}

function extractChecksMarkdown(reportMarkdown: string) {
  return reportMarkdown.slice(reportMarkdown.indexOf('## Checks'))
}

function extractTextFromMarkdown(markdownText: string) {
  return markdownText.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
}

export async function pushChecksSummaryToDiscord(reportMarkdown: string, proposalNo: string) {
  const header = `# Summary of Compound Checks for proposal # ${proposalNo}\n\n`
  const appendix = '... \n\n(see report for full text)'
  const maxLength = 2000 - appendix.length - header.length
  let discordPayload = extractChecksMarkdown(reportMarkdown)

  if (discordPayload.length >= 2000) {
    let checksText = extractTextFromMarkdown(discordPayload)
    discordPayload = header + (checksText.length < maxLength ? checksText : checksText.slice(0, maxLength) + appendix)
  } else {
    discordPayload = header + discordPayload
    if (discordPayload.length > 2000) {
      discordPayload = header + discordPayload.slice(0, maxLength) + appendix
    }
  }
  await postNotificationToDiscord(discordPayload)
}
