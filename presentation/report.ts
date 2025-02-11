import { Block } from '@ethersproject/abstract-provider'
import { BigNumber } from 'ethers'
import fs, { promises as fsp } from 'fs'
import { mdToPdf } from 'md-to-pdf'
import { remark } from 'remark'
import remarkToc from 'remark-toc'
import { capitalizeWord, checkforumPost, iconLookupTable, tab } from '../checks/compound/formatters/helper'
import { pushChecksSummaryToDiscordAsEmbeds } from '../checks/compound/formatters/push-to-discord'
import { sendEmails } from '../checks/compound/formatters/push-to-email'
import { AllCheckResults, GovernorType, ProposalEvent } from '../types'
import { formatProposalId } from '../utils/contracts/governor'
import { getExplorerBaseUrl } from './../checks/compound/abi-utils'
import { CometChains, GovernanceProposalAnalysis } from './../checks/compound/compound-types'
import { toMarkdownAndHTML } from './toMarkdownAndHTML'

// --- Markdown helpers ---

export function bullet(text: string, level: number = 0): string {
  return `${' '.repeat(level * 4)}- ${text}`
}

export function bold(text: string): string {
  return `**${text}**`
}

export function codeBlock(text: string): string {
  // Line break, three backticks, line break, the text, line break, three backticks, line break
  return `\n\`\`\`\n${text}\n\`\`\`\n`
}

/**
 * Block quotes a string in markdown
 * @param str string to block quote
 */
export function blockQuote(str: string): string {
  return str
    .split('\n')
    .map((s) => '> ' + s)
    .join('\n')
}

/**
 * Turns a plaintext address into a link to explorer page of that address
 * @param address to be linked
 * @param code whether to link to the code tab
 * @param chain to be used
 */
export function toAddressLink(
  address: string,
  chain: CometChains,
  code: boolean = false,
): string {
  return `[\`${address}\`](${getExplorerBaseUrl(chain)}/${address}${code ? '#code' : ''})`
}

// -- Report formatters ---

export function toMessageList(header: string, text: string[]): string {
  return text.length > 0 ? `${bold(header)}:\n\n` + text.map((msg) => `${msg}`).join('\n') : ''
}

/**
 * Summarize the results of a specific check
 * @param errors the errors returned by the check
 * @param warnings the warnings returned by the check
 * @param name the descriptive name of the check
 */
export function toCheckSummary({ result: { errors, warnings, info }, name }: AllCheckResults[string]): string {
  const status =
    errors.length === 0 ? (warnings.length === 0 ? '✅ Passed' : '❗❗ **Passed with warnings**') : '❌ **Failed**'

  return `#### ${name} ${status}

${toMessageList('Errors', errors)}

${toMessageList('Warnings', warnings)}

${toMessageList('Info', info)}
`
}

function populateChecks(checks: AllCheckResults, sourceChain: CometChains): string {
  // Collect mainnet and bridged summaries separately
  const mainnetSummaries: string[] = []
  const bridgedSummaries: Record<string, string[]> = {}

  // Iterate through all checks and organize the summaries
  Object.keys(checks).forEach((checkId) => {
    const {
      result: { errors, warnings, info, bridgedCheckResults },
      name,
    } = checks[checkId]

    // Add to mainnet summaries
    mainnetSummaries.push(
      toCheckSummary({
        result: { errors, warnings, info },
        name,
      }),
    )

    // Process bridged results if any
    if (bridgedCheckResults) {
      bridgedCheckResults.forEach(({ chain, checkResults }) => {
        if (!bridgedSummaries[chain]) {
          bridgedSummaries[chain] = []
        }
        bridgedSummaries[chain].push(
          toCheckSummary({
            result: { ...checkResults },
            name,
          }),
        )
      })
    }
  })

  // Create the consolidated mainnet summary
  const mainnetSummary = `### ${capitalizeWord(sourceChain)} Changes\n\n${mainnetSummaries.join('\n\n')}`

  // Create the consolidated bridged summaries for each chain
  const bridgedSummary = Object.keys(bridgedSummaries)
    .map((chain) => `### Bridge Changes of ${capitalizeWord(chain)}\n\n${bridgedSummaries[chain].join('\n\n')}`)
    .join('\n\n')

  // Combine all summaries
  return `${mainnetSummary}\n\n${bridgedSummary}`
}

/**
 * Pulls the title out of the markdown description, from the first markdown h1 line
 * @param description the proposal description
 */
function getProposalTitle(description: string) {
  const match = description.match(/^\s*#\s*(.*)\s*\n/)
  if (!match || match.length < 2) return 'Title not found'
  return match[1]
}

/**
 * Format a block timestamp which is always in epoch seconds to a human readable string
 * @param blockTimestamp the block timestamp to format
 */
function formatTime(blockTimestamp: number): string {
  return `${new Date(blockTimestamp * 1000).toLocaleString('en-US', {
    timeZone: 'America/New_York',
  })} ET`
}

/**
 * Estimate the timestamp of a future block number
 * @param current the current block
 * @param block the future block number
 */
function estimateTime(current: Block, block: BigNumber): number {
  if (block.lt(current.number)) throw new Error('end block is less than current')
  return block.sub(current.number).mul(13).add(current.timestamp).toNumber()
}

/**
 * Generates the proposal report and saves Markdown, PDF, and HTML versions of it.
 * @param blocks the relevant blocks for the proposal.
 * @param proposal The proposal details.
 * @param checks The checks results.
 * @param dir The directory where the file should be saved. It will be created if it doesn't exist.
 * @param filename The name of the file. All report formats will have the same filename with different extensions.
 */
export async function generateAndSaveReports(
  sourceChain: CometChains,
  proposalId: string,
  blocks: { current: Block; start: Block | null; end: Block | null },
  proposal: ProposalEvent,
  checks: AllCheckResults,
  dir: string,
  compProposalAnalysis: GovernanceProposalAnalysis,
) {
  // Prepare the output folder and filename.
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const path = `${dir}/${proposalId}`

  // Generate the base markdown proposal report. This is the markdown report which is translated into other file types.
  const baseReport = await toMarkdownProposalReport(sourceChain, proposalId, blocks, proposal, checks, compProposalAnalysis)
  const { markdownReport, htmlReport } = await toMarkdownAndHTML(baseReport)

  // Save off all reports. The Markdown and PDF reports use the `markdownReport`.
  await Promise.all([
    fsp.writeFile(`${path}.html`, htmlReport),
    fsp.writeFile(`${path}.md`, markdownReport),
    mdToPdf(
      { content: markdownReport },
      {
        dest: `${path}.pdf`,
        launch_options: { args: ['--no-sandbox', '--disable-setuid-sandbox'] },
        css: 'body { word-wrap: break-word; overflow-wrap: break-word; hyphens: auto;}',
      },
    ),
  ])
}

function getFailedChecksAndWarnings(checks: AllCheckResults) {
  const failedChecks = Object.entries(checks)
    .filter(([_, { result }]) => result.errors.length > 0)
    .map(
      ([_, { name, result }]) =>
        `- ${bold(`${name} ❌ Failed`)} \n${result.errors.map((error) => `${tab}${error}`).join('\n')}`,
    )

  const warningChecks = Object.entries(checks)
    .filter(([_, { result }]) => result.warnings.length > 0)
    .map(
      ([_, { name, result }]) =>
        `- ${bold(`${name} ❗❗ Passed with warnings`)} \n${result.warnings
          .map((warning) => `${tab}${warning}`)
          .join('\n')}`,
    )
  return { failedChecks, warningChecks }
}

export async function pushCompoundChecksToDiscord(
  proposal: ProposalEvent,
  checks: AllCheckResults,
  compProposalAnalysis: GovernanceProposalAnalysis,
) {
  const { failedChecks, warningChecks } = getFailedChecksAndWarnings(checks)

  await pushChecksSummaryToDiscordAsEmbeds(failedChecks, warningChecks, compProposalAnalysis, proposal.id!.toString())
}

export async function pushCompoundChecksToEmail(
  chain: CometChains,
  proposalNo: string,
  checks: AllCheckResults,
  compoundChecks: GovernanceProposalAnalysis,
  folderPath: string,
) {
  const { failedChecks } = getFailedChecksAndWarnings(checks)

  const hasMarketUpdates =
    compoundChecks.mainnetActionAnalysis.length > 0 || compoundChecks.chainedProposalAnalysis.length > 0
  let marketUpdates = '**No market updates in this proposal.**'
  if (hasMarketUpdates) {
    marketUpdates = toMessageList(
      `${capitalizeWord(chain)} Actions`,
      compoundChecks.mainnetActionAnalysis.map((a) => a.summary),
    )

    marketUpdates += '\n\n'

    marketUpdates += compoundChecks.chainedProposalAnalysis
      .map((cp) =>
        toMessageList(
          `Bridge wrapped actions to ${capitalizeWord(cp.chain)}`,
          cp.actionAnalysis.map((a) => a.summary),
        ),
      )
      .join('\n\n')
  }

  const content =
    `## Summary of Compound Checks - Proposal #[${proposalNo}](https://compound.finance/governance/proposals/${proposalNo})
  
${toMessageList('Errors', failedChecks) || '**No errors found simulating this proposal.**'}
  
${marketUpdates} 
  
See the full report [here](https://compound-governance-proposals.s3.amazonaws.com/${folderPath}/${proposalNo}.pdf) for all updates.
`.trim()

  await sendEmails(proposalNo, content)
}

/**
 * Produce a markdown report summarizing the result of all the checks for a given proposal.
 * @param blocks the relevant blocks for the proposal.
 * @param proposal The proposal details.
 * @param checks The checks results.
 */
async function toMarkdownProposalReport(
  sourceChain: CometChains,
  proposalID: string,
  blocks: { current: Block; start: Block | null; end: Block | null },
  proposal: ProposalEvent,
  checks: AllCheckResults,
  compProposalAnalysis: GovernanceProposalAnalysis,
): Promise<string> {
  const { proposer, targets, endBlock, startBlock, description } = proposal

  // Generate the report. We insert an empty table of contents header which is populated later using remark-toc.
  const report = `
# ${getProposalTitle(description.trim())}

_Updated as of block [${blocks.current.number}](https://etherscan.io/block/${blocks.current.number}) at ${formatTime(
    blocks.current.timestamp,
  )}_

- ID: ${proposalID}
- Proposer: ${toAddressLink(proposer, sourceChain)}
- Start Block: ${startBlock} (${
    blocks.start ? formatTime(blocks.start.timestamp) : formatTime(estimateTime(blocks.current, startBlock))
  })
- End Block: ${endBlock} (${
    blocks.end ? formatTime(blocks.end.timestamp) : formatTime(estimateTime(blocks.current, endBlock))
  })
- Targets: ${targets.map((target) => toAddressLink(target, sourceChain, true)).join('; ')}

## Forum Post

${checkforumPost(description.trim(), proposalID)} 

## Table of contents

This is filled in by remark-toc and this sentence will be removed.

## Proposal Text

${blockQuote(description.trim())}

## Checks\n
${populateChecks(checks, sourceChain)}
  
## Compound Checks\n

### Legend

| Icon | Description |
|------|-------------|
${Object.values(iconLookupTable)
  .map(({ icon, description }) => `| ${icon} | ${description} |`)
  .join('\n')}

${toMessageList(
  `${capitalizeWord(sourceChain)} Actions`,
  compProposalAnalysis.mainnetActionAnalysis.map((a) => a.details),
)}
\n\n
${compProposalAnalysis.chainedProposalAnalysis
  .map((cp) =>
    toMessageList(
      `Bridge wrapped actions to ${capitalizeWord(cp.chain)}`,
      cp.actionAnalysis.map((a) => a.details),
    ),
  )
  .join('\n\n')}
`

  // Add table of contents and return report.
  return (await remark().use(remarkToc, { tight: true }).process(report)).toString()
}
