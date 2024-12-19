import fs from 'fs'
import { ProposalData, ProposalEvent, TenderlySimulation } from './../../types'
import { ActionAnalysis, GovernanceProposalAnalysis, ProposalActionResponse } from './compound-types'
import { defactorFn } from './../../utils/roundingUtils'
import { getContractNameAndAbiFromFile, getFunctionFragmentAndDecodedCalldata, getFunctionSignature } from './abi-utils'
import {
  CometChains,
  ContractNameAndAbi,
  ContractTypeFormattingInfo,
  ExecuteTransactionInfo,
  ExecuteTransactionsInfo,
  TargetTypeLookupData,
} from './compound-types'
import { getIcon, getPlatform, getRecipientNameWithLink, IconType, tab } from './formatters/helper'
import { getDecodedBytesForChain, l2Bridges } from './l2-utils'
import { formattersLookup } from './transaction-formatter'
import { generateAISummary } from './aiSummary'

export async function analyzeProposal(proposal: ProposalEvent, sim: TenderlySimulation, deps: ProposalData): Promise<GovernanceProposalAnalysis> {
  const { targets: targets, signatures: signatures, calldatas: calldatas, values } = proposal
  const chain = CometChains.mainnet
  const proposalId = proposal.id?.toNumber() || 0

  const checkResults = await getCompoundCheckResults(chain, proposalId, { targets, signatures, calldatas, values })

  return checkResults
}

async function getCompoundCheckResults(
  chain: CometChains,
  proposalId: number,
  transactions: ExecuteTransactionsInfo,
  isL2 = false
): Promise<GovernanceProposalAnalysis> {
  const { targets, signatures, calldatas, values } = transactions

  let messageCount = 0

  const checkResults: GovernanceProposalAnalysis = { info: [], chainedProposalAnalysis: [], mainnetActionAnalysis: [] }

  for (const [i, targetNoCase] of targets.entries()) {
    const target = targetNoCase.toLowerCase()
    const transactionInfo: ExecuteTransactionInfo = {
      target,
      signature: signatures[i],
      calldata: calldatas[i],
      value: values?.[i],
    }
    if (Object.keys(l2Bridges).includes(target)) {
      const cometChain = l2Bridges[target]
      const l2TransactionsInfo = await getDecodedBytesForChain(cometChain, proposalId, transactionInfo)
      const l2CheckResults = await getCompoundCheckResults(cometChain, proposalId, l2TransactionsInfo, true)
      const l2Messages = nestCheckResultsForChain(cometChain, l2CheckResults)
      const countPrefixedL2Messages = `\n\n${++messageCount}. ${l2Messages}`
      pushMessageToCheckResults(checkResults, countPrefixedL2Messages, messageCount, cometChain)
      continue
    }

    const message = await getTransactionMessages(chain, proposalId, transactionInfo)
    pushMessageToCheckResults(checkResults, message, messageCount)
  }
  return checkResults
}

function pushMessageToCheckResults(checkResults: GovernanceProposalAnalysis, message: ProposalActionResponse, messageCount: number, cometChain?: CometChains) {
  const messagePrefix = cometChain ? '' : `\n\n${++messageCount}. `
  const messageInfo = `${messagePrefix}${message}`

  if (typeof message === 'string') {
    checkResults.info.push(messageInfo)
    return
  } else {
    if (cometChain) {
      const chainedProposalAnalysis = checkResults.chainedProposalAnalysis.find((ca) => ca.chain === cometChain)
      if (chainedProposalAnalysis) {
        chainedProposalAnalysis.actionAnalysis.push(message)
        return
      } else {
        checkResults.chainedProposalAnalysis.push({ chain: cometChain, actionAnalysis: [message] })
        return
      }
    } else {
      checkResults.mainnetActionAnalysis.push(message)
      return
    }
  }

  throw new Error('We should not be having warning or error message')
}

function nestCheckResultsForChain(chain: CometChains, checkResult: GovernanceProposalAnalysis): string {
  const capitalizedChain = `${chain.charAt(0).toUpperCase()}${chain.slice(1)}`
  const alphabetPrefixedL2Messages = checkResult.info.map((message, index) => {
    // use a..z for nested messages
    const letter = String.fromCharCode(97 + index)
    return `\n\n${tab}${letter}. ${message}`
  })
  return `**Bridge wrapped actions to ${capitalizedChain}**\n\n${tab}${alphabetPrefixedL2Messages.join()}`
}

function getFormatterForContract(contractNameAndAbi: ContractNameAndAbi): ContractTypeFormattingInfo {
  const contractName = contractNameAndAbi.contractName
  const targetLookupFilePath = `./checks/compound/lookup/targetType.json`

  const fileContent = fs.readFileSync(targetLookupFilePath, 'utf-8')
  const lookupData: TargetTypeLookupData = JSON.parse(fileContent || '{}')

  const targetNameToTypeFilePath = `./checks/compound/lookup/targetNameToType.json`
  const targetNameToTypeFileContent = fs.readFileSync(targetNameToTypeFilePath, 'utf-8')
  const targetNameToTypeLookupData: { [contractName: string]: string } = JSON.parse(targetNameToTypeFileContent || '{}')

  const contractType = targetNameToTypeLookupData[contractName]

  const contractFormatters: ContractTypeFormattingInfo = contractType ? lookupData[contractType] : lookupData[contractName]

  if (!contractFormatters) {
    throw new Error(`No contract formatters found for ContractName - ${contractName} and Type - ${contractType}`)
  }

  return contractFormatters
}

async function getTransactionMessages(chain: CometChains, proposalId: number, transactionInfo: ExecuteTransactionInfo): Promise<ProposalActionResponse> {
  const { target, value, signature } = transactionInfo
  const contractNameAndAbi = await getContractNameAndAbiFromFile(chain, target)
  if (value?.toString() && value?.toString() !== '0') {
    const platform = getPlatform(chain)
    if (!signature) {
      return `Transfer **${defactorFn(value.toString())} ETH** to ${await getRecipientNameWithLink(chain, target)}.`
    } else {
      const { decodedCalldata } = await getFunctionFragmentAndDecodedCalldata(proposalId, chain, transactionInfo)
      if (contractNameAndAbi.contractName.toLowerCase() === 'WETH9'.toLowerCase() && signature === 'deposit()') {
        return `Wrap **${defactorFn(value.toString())} ETH** to **[WETH](https://${platform}/address/${target})**.`
      }
      return `${target}.${signature.split('(')[0]}(${decodedCalldata.join(',')}) and Transfer ${defactorFn(value.toString())} ETH to ${target}`
    }
  }
  if (isRemovedFunction(target, signature)) {
    return `${getIcon(IconType.Attention)} Function ${signature} is removed from ${target} contract`
  }

  try {
    const { fun, decodedCalldata } = await getFunctionFragmentAndDecodedCalldata(proposalId, chain, transactionInfo)

    const functionSignature = getFunctionSignature(fun)

    let contractFormatters: ContractTypeFormattingInfo
    try {
      contractFormatters = getFormatterForContract(contractNameAndAbi)
    } catch (err) {
      // If no contract formatters are found at all, fallback to AI summary
      console.error(`No contract formatters found for ${contractNameAndAbi.contractName}`, err)
      const aiSummary = await generateAISummary(chain, target, functionSignature, decodedCalldata)
      return aiSummary
    }

    const functions = contractFormatters.functions
    const functionMapping = functions?.[functionSignature]
    const transactionFormatter = functionMapping?.transactionFormatter

    if (!functions || !functionMapping || !transactionFormatter) {
      console.error(
        `No functions found for ContractName - ${contractNameAndAbi.contractName}. FunctionSignature - ${functionSignature}. TransactionFormatter - ${transactionFormatter}. FunctionMapping - ${functionMapping}`
      )
      const aiSummary = await generateAISummary(chain, target, functionSignature, decodedCalldata)
      return aiSummary
    }

    const [contractName, formatterName] = transactionFormatter.split('.')
    console.log(`GetFormatter: ContractName - ${contractName} and FormatterName - ${formatterName}`)
    const formattersLookupElement = formattersLookup[contractName]?.[formatterName]

    if (!formattersLookupElement) {
      const aiSummary = await generateAISummary(chain, target, functionSignature, decodedCalldata)
      return aiSummary
    } else {
      const formattedResponse: string | ActionAnalysis = await formattersLookupElement(
        chain,
        transactionInfo,
        decodedCalldata.map((data: any) => data.toString())
      )

      if (typeof formattedResponse === 'string') {
        return formattedResponse
      } else {
        return formattedResponse
      }
    }
  } catch (error) {
    console.error(`Error in decoding transaction ${JSON.stringify(transactionInfo)}`)
    console.error(error)
    return `Error in decoding transaction: **${transactionInfo.target}.${transactionInfo.signature} called with:** (${transactionInfo.calldata})`
  }
}

function isRemovedFunction(target: string, signature: string) {
  const removedFunctions: { [target: string]: string[] } = {
    '0x70e36f6bf80a52b3b46b3af8e106cc0ed743e8e4': ['_setImplementation(address,bool,bytes)'],
    '0x5d3a536e4d6dbd6114cc1ead35777bab948e3643': ['_setImplementation(address,bool,bytes)'],
    '0xface851a4921ce59e912d19329929ce6da6eb0c7': ['_setImplementation(address,bool,bytes)'],
    '0x12392f67bdf24fae0af363c24ac620a2f67dad86': ['_setImplementation(address,bool,bytes)'],
    '0x35a18000230da775cac24873d00ff85bccded550': ['_setImplementation(address,bool,bytes)'],
    '0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9': ['_setImplementation(address,bool,bytes)'],
    '0xccf4429db6322d5c611ee964527d42e5d685dd6a': ['_setImplementation(address,bool,bytes)'],
    '0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b': ['_setPendingImplementation(address)', '_setCompSpeed(address,uint256)', '_sweep(address)'],
    '0xc0da02939e1441f497fd74f78ce7decb17b66529': ['_setImplementation(address)'],
    '0x95b4ef2869ebd94beb4eee400a99824bf5dc325b': ['_setImplementation(address,bool,bytes)'],
    '0x7713dd9ca933848f6819f38b8352d9a15ea73f67': ['_setImplementation(address,bool,bytes)'],
    '0xe65cdb6479bac1e22340e4e755fae7e509ecd06c': ['_setImplementation(address,bool,bytes)'],
    '0x80a2ae356fc9ef4305676f7a3e2ed04e12c33946': ['_setImplementation(address,bool,bytes)'],
    '0x4b0181102a0112a2ef11abee5563bb4a3176c9d7': ['_setImplementation(address,bool,bytes)'],
    '0x041171993284df560249b57358f931d9eb7b925d': ['_setImplementation(address,bool,bytes)'],
  }
  return removedFunctions[target]?.includes(signature)
}
