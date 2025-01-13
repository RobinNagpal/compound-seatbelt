import axios from 'axios'
import FormData from 'form-data'
import { DISCORD_WEBHOOK_URL } from './../../../utils/constants'
import { GovernanceProposalAnalysis } from './../../compound/compound-types'
import { capitalizeWord, checkforumPost } from './helper'

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

function getEmbedMessage(m: string) {
  if (!m) return ''
  if (m.length < 3000) return m

  const textFromMarkdown = extractTextFromMarkdown(m)
  if (textFromMarkdown.length < 4000) return textFromMarkdown

  // add ...more to the end of the message
  return textFromMarkdown.slice(0, 4000) + '...more'
}

interface Embed {
  description: string
  color: number
}

function adjustMessageLength(messages: Embed[]): Embed[] {
  const maxLength = 4000
  let totalLength = messages.reduce((sum, current) => sum + current.description.length, 0)

  const numMessages = messages.length

  if (totalLength <= maxLength) {
    return messages
  }

  const shortenedMessages: Embed[] = messages.map((m) => {
    if (m.description.length > maxLength / numMessages) {
      m.description = m.description.substring(0, maxLength / numMessages - '    ...more'.length) + '    ...more'
    }

    return m
  })

  return shortenedMessages
}

export async function pushChecksSummaryToDiscordAsEmbeds(
  failedChecks: string[],
  warningChecks: string[],
  compoundChecks: GovernanceProposalAnalysis,
  proposalNo: string
) {
  const s3ReportsFolder = process.env.AWS_BUCKET_BASE_PATH || 'all-proposals'

  const failedEmbeds = (failedChecks || []).map((m) => ({
    description: m,
    color: 16711680, // Red color for failed checks
  }))

  const warningEmbeds = (warningChecks || []).map((m) => ({
    description: m,
    color: 16776960, // Yellow color for warning checks
  }))

  const compoundMainnetEmbeds = compoundChecks.mainnetActionAnalysis.map((m) => {
    const embedMessage = getEmbedMessage(m.summary)
    return {
      description: embedMessage,
      color: 1127128, // Blue color for info messages
    }
  })

  const compoundChainEmbeds = compoundChecks.chainedProposalAnalysis.map((m) => {
    return {
      description: `Bridge wrapped actions to ${capitalizeWord(m.chain)}`,
      color: 1127128, // Blue color for info messages
      fields: m.actionAnalysis.map((a) => ({
        name: '',
        value: a.summary,
      })),
    }
  })

  // Combine failedEmbeds and compoundEmbeds
  const allEmbeds = [...failedEmbeds, ...warningEmbeds, ...compoundMainnetEmbeds, ...compoundChainEmbeds]

  // Discord limits
  const MAX_EMBEDS_PER_MESSAGE = 6
  const MAX_CONTENT_LENGTH = 2000 // Max length for content field
  const MAX_EMBED_TOTAL_LENGTH = 6000 // Max total length of all embeds per message

  // Split embeds into chunks
  const embedChunks = []
  for (let i = 0; i < allEmbeds.length; i += MAX_EMBEDS_PER_MESSAGE) {
    embedChunks.push(allEmbeds.slice(i, i + MAX_EMBEDS_PER_MESSAGE))
  }

  // Send each chunk as a separate message
  for (let idx = 0; idx < embedChunks.length; idx++) {
    const embedsChunk = embedChunks[idx]

    // Adjust embed descriptions if total length exceeds limit
    let totalEmbedLength = embedsChunk.reduce((sum, embed) => sum + embed.description.length, 0)
    if (totalEmbedLength > MAX_EMBED_TOTAL_LENGTH) {
      for (let embed of embedsChunk) {
        if (embed.description.length > 500) {
          embed.description = embed.description.slice(0, 500) + '...'
        }
      }
    }

    let content = ''
    if (idx === 0) {
      content = `
## Summary of Compound Checks - [${proposalNo}](https://compound.finance/governance/proposals/${proposalNo})
[Full Report](https://compound-governance-proposals.s3.amazonaws.com/${s3ReportsFolder}/${proposalNo}.pdf)
      `.trim()
    } else {
      content = '' // Empty content for subsequent messages
    }

    try {
      await axios.post(DISCORD_WEBHOOK_URL, {
        content: content,
        embeds: embedsChunk,
      })
    } catch (error: any) {
      // Handle error
      if (error?.response) {
        console.log(error.response.data)
        console.log(error.response.status)
        console.log(error.response.headers)
      } else if (error?.request) {
        console.log(error.request)
      } else {
        console.log('Error', error?.message)
      }
      console.log(error?.config)
      throw error
    }
  }
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
