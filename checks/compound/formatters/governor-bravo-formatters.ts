import { Contract } from 'ethers'
import { getContractNameAndAbiFromFile } from '../abi-utils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from './../compound-types'
import { addCommas, addressFormatter, getChangeTextFn, getIcon, getPlatform, getRecipientNameWithLink, IconType, tab } from './helper'
import { customProvider } from '../../../utils/clients/ethers'
import { defactorFn, subtractFn } from './../../../utils/roundingUtils'

export const governorBravoFormatters: { [functionName: string]: TransactionFormatter } = {
  '_setProposalThreshold(uint256)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const governanceAddress = transaction.target
    const { abi } = await getContractNameAndAbiFromFile(chain, governanceAddress)
    const governanceInstance = new Contract(governanceAddress, abi, customProvider(chain))

    const name = await governanceInstance.callStatic.name()

    const prevThresholdRaw = (await governanceInstance.callStatic.proposalThreshold()).toString()
    const prevThreshold = defactorFn(prevThresholdRaw)
    const newThresholdRaw = decodedParams[0]
    const newThreshold = defactorFn(newThresholdRaw)

    const changeInThreshold = subtractFn(newThreshold, prevThreshold)

    const functionDesc = `Update proposal threshold of **${addressFormatter(transaction.target, chain, name)}**`
    const normalizedChanges = `Update from ${addCommas(prevThreshold)} to ${addCommas(newThreshold)} ${getChangeTextFn(changeInThreshold)}`
    const rawChanges = `Update from ${prevThresholdRaw} to ${newThresholdRaw}`

    return `${functionDesc}.\n\n${tab}**Changes:** ${normalizedChanges}\n\n${tab}**Raw Changes:** ${rawChanges}`
  },
  '_setWhitelistGuardian(address)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const governanceAddress = transaction.target
    const { abi } = await getContractNameAndAbiFromFile(chain, governanceAddress)
    const governanceInstance = new Contract(governanceAddress, abi, customProvider(chain))

    const name = await governanceInstance.callStatic.name()
    const guardianLink = addressFormatter(governanceAddress, chain, name)

    const details = `${getIcon(IconType.Update)} Update the Whitelist Guardian of **${guardianLink}** to ${await getRecipientNameWithLink(chain, decodedParams[0])}.`
    return { summary: details, details }
  },
  '_setVotingDelay(uint256)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const governanceAddress = transaction.target
    const { abi } = await getContractNameAndAbiFromFile(chain, governanceAddress)
    const governanceInstance = new Contract(governanceAddress, abi, customProvider(chain))

    const name = await governanceInstance.callStatic.name()
    const prevVotingDelay = (await governanceInstance.callStatic.votingDelay()).toString()
    const newVotingDelay = decodedParams[0]

    return `${getVotingChangeText('Delay', governanceAddress, chain, name, prevVotingDelay, newVotingDelay)}`
  },
  '_setVotingPeriod(uint256)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const governanceAddress = transaction.target
    const { abi } = await getContractNameAndAbiFromFile(chain, governanceAddress)
    const governanceInstance = new Contract(governanceAddress, abi, customProvider(chain))

    const name = await governanceInstance.callStatic.name()
    const prevVotingPeriod = (await governanceInstance.callStatic.votingPeriod()).toString()
    const newVotingPeriod = decodedParams[0]

    return `${getVotingChangeText('Period', governanceAddress, chain, name, prevVotingPeriod, newVotingPeriod)}`
  },
}

function getVotingChangeText(type: string, governanceAddress: string, chain: CometChains, name: string, prevVoting: string, newVoting: string) {
  const changeInVoting = subtractFn(newVoting, prevVoting)

  const functionDesc = `Set Voting ${type} of **${addressFormatter(governanceAddress, chain, name)}**`
  const normalizedChanges = `Update from ${addCommas(prevVoting)} blocks to ${addCommas(newVoting)} blocks ${getChangeTextFn(changeInVoting)}`
  const rawChanges = `Update from ${prevVoting} to ${newVoting}`

  return `${functionDesc}.\n\n${tab}**Changes:** ${normalizedChanges}\n\n${tab}**Raw Changes:** ${rawChanges}`
}
