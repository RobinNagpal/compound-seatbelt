import dotenv from 'dotenv'
dotenv.config()

import axios from 'axios'
import { Contract, ethers } from 'ethers'
import FormData from 'form-data'
import fs from 'fs'
import mftch from 'micro-ftch'
import { CometChains, SymbolAndDecimalsLookupData } from '../compound-types'
import { CheckResult } from './../../../types'
import { customProvider } from './../../../utils/clients/ethers'
import { DISCORD_WEBHOOK_URL } from './../../../utils/constants'
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

export function getCriticalitySign(changeInString: string, { warningThreshold, criticalThreshold }: { warningThreshold: number; criticalThreshold: number }) {
  const change = parseFloat(changeInString)

  if (change <= -criticalThreshold || change >= criticalThreshold) {
    return '🛑'
  } else if (change <= -warningThreshold || change >= warningThreshold) {
    return '⚠️'
  } else {
    return ''
  }
}

export async function fetchAssertIdFromCoinGeckoForSymbol(symbol: string) {
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

function extractChecksMarkdown(reportMarkdown: string) {
  return reportMarkdown.slice(reportMarkdown.indexOf('## Checks'))
}

function extractTextFromMarkdown(markdownText: string) {
  return markdownText.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
}

export async function pushChecksSummaryToDiscord(reportMarkdown: string, proposalNo: string) {
  const forumPost = checkforumPost(reportMarkdown, proposalNo)
  let header = `# Summary of Compound Checks for proposal # ${proposalNo}\n\n`
  header += `\n\n### ${forumPost}\n\n`
  const appendix = `... \n\n[See Full Report](https://compound-governance-proposals.s3.amazonaws.com/all-proposals/${proposalNo}.pdf)`
  let discordPayload = extractChecksMarkdown(reportMarkdown)

  await postNotificationToDiscord(`${header} ${discordPayload} ${appendix}`)
}

export async function pushChecksSummaryToDiscordAsEmbeds(checkResult: CheckResult, proposalNo: string) {
  const s3ReportsFolder = process.env.AWS_BUCKET_BASE_PATH || 'all-proposals'
  await axios.post(DISCORD_WEBHOOK_URL, {
    content: `
    ## Summary of Compound Checks - [${proposalNo}](https://compound.finance/governance/proposals/${proposalNo})
    [Full Report](https://compound-governance-proposals.s3.amazonaws.com/${s3ReportsFolder}/${proposalNo}.pdf)
    `,
    embeds: checkResult.info.map((m) => ({
      description: m,
      color: 1127128,
    })),
  })
}

export async function postNotificationToDiscord(rawText: string) {
  const text = rawText.length > 2000 ? extractTextFromMarkdown(rawText) : rawText

  if (text.length <= 2000) {
    // If text is within the character limit, send as plain text
    try {
      await axios.post(DISCORD_WEBHOOK_URL, { content: text })
      console.log('Successfully sent message to Discord.')
    } catch (error) {
      console.error('Error sending message to Discord:', error)
    }
  } else {
    // If text exceeds the limit, upload as a file
    const formData = new FormData()
    formData.append('files[0]', Buffer.from(rawText, 'utf-8'), 'message.md')
    formData.append('payload_json', JSON.stringify({ content: 'The message exceeded 2000 characters. Please see the attached file.' }))

    try {
      await axios.post(DISCORD_WEBHOOK_URL, formData, {
        headers: {
          ...formData.getHeaders(),
        },
      })
      console.log('Successfully sent file to Discord.')
    } catch (error) {
      console.error('Error sending file to Discord:', error)
    }
  }
}
