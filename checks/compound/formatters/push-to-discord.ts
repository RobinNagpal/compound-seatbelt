import axios from 'axios'
import FormData from 'form-data'
import { CheckResult } from './../../../types'
import { DISCORD_WEBHOOK_URL } from './../../../utils/constants'
import { checkforumPost } from './helper'

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

export async function pushChecksSummaryToDiscordAsEmbeds(failedChecks: string[], checkResult: CheckResult, proposalNo: string) {
  const s3ReportsFolder = process.env.AWS_BUCKET_BASE_PATH || 'all-proposals'
  const failedEmbeds = (failedChecks || []).map((m) => ({
    description: m,
    color: 16711680,
  }))

  const compoundEmbeds = checkResult.info.map((m) => {
    const embedMessage = getEmbedMessage(m)
    return {
      description: embedMessage,
      color: 1127128,
    }
  })

  console.log('before', compoundEmbeds)
  const adjustedCompoundEmbeds = adjustMessageLength(compoundEmbeds)
  console.log('adjustedCompoundEmbeds', adjustedCompoundEmbeds)

  try {
    await axios.post(DISCORD_WEBHOOK_URL, {
      content: `
    ## Summary of Compound Checks - [${proposalNo}](https://compound.finance/governance/proposals/${proposalNo})
    [Full Report](https://compound-governance-proposals.s3.amazonaws.com/${s3ReportsFolder}/${proposalNo}.pdf)
    `,
      embeds: [...failedEmbeds, ...adjustedCompoundEmbeds],
    })
  } catch (error: any) {
    if (error?.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.log(error.response.data)
      console.log(error.response.status)
      console.log(error.response.headers)
    } else if (error?.request) {
      // The request was made but no response was received
      // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
      // http.ClientRequest in node.js
      console.log(error.request)
    } else {
      // Something happened in setting up the request that triggered an Error
      console.log('Error', error?.message)
    }
    console.log(error?.config)

    throw error
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
