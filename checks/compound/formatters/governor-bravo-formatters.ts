import { Contract } from 'ethers'
import { getContractNameAndAbiFromFile } from '../abi-utils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from './../compound-types'
import { addCommas, formatCoinsAndAmounts, getChangeTextFn, getPlatform, getRecipientNameWithLink } from './helper'
import { customProvider } from '../../../utils/clients/ethers'
import { defactorFn, subtractFn } from './../../../utils/roundingUtils'

export const governorBravoFormatters: { [functionName: string]: TransactionFormatter } = {
  '_setProposalThreshold(uint256)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = getPlatform(chain)

    const governanceAddress = transaction.target
    const { abi } = await getContractNameAndAbiFromFile(chain, governanceAddress)
    const governanceInstance = new Contract(governanceAddress, abi, customProvider(chain))

    const name = await governanceInstance.callStatic.name()

    const prevThreshold = defactorFn((await governanceInstance.callStatic.proposalThreshold()).toString())
    const newThreshold = defactorFn(decodedParams[0])

    const changeInThreshold = subtractFn(newThreshold, prevThreshold)

    return `Set proposal threshold of **[${name}](https://${platform}/address/${transaction.target})** from ${addCommas(prevThreshold)} to ${addCommas(
      newThreshold
    )} ${getChangeTextFn(changeInThreshold)}`
  },
  '_setWhitelistGuardian(address)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = getPlatform(chain)

    const governanceAddress = transaction.target
    const { abi } = await getContractNameAndAbiFromFile(chain, governanceAddress)
    const governanceInstance = new Contract(governanceAddress, abi, customProvider(chain))

    const name = await governanceInstance.callStatic.name()

    return `Set the Whitelist Guardian of **[${name}](https://${platform}/address/${governanceAddress})** to ${getRecipientNameWithLink(
      chain,
      decodedParams[0]
    )}.`
  },
  '_setVotingDelay(uint256)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = getPlatform(chain)

    const governanceAddress = transaction.target
    const { abi } = await getContractNameAndAbiFromFile(chain, governanceAddress)
    const governanceInstance = new Contract(governanceAddress, abi, customProvider(chain))

    const name = await governanceInstance.callStatic.name()
    const prevVotingDelay = (await governanceInstance.callStatic.votingDelay()).toString()
    const newVotingDelay = decodedParams[0]

    const changeInVotingDelay = subtractFn(newVotingDelay, prevVotingDelay)

    return `Voting Delay (number of Ethereum blocks to wait before voting on a proposal may begin) of **[${name}](https://${platform}/address/${governanceAddress})** is changed from ${addCommas(
      prevVotingDelay
    )} blocks to ${addCommas(newVotingDelay)} blocks ${getChangeTextFn(changeInVotingDelay)}`
  },
  '_setVotingPeriod(uint256)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = getPlatform(chain)

    const governanceAddress = transaction.target
    const { abi } = await getContractNameAndAbiFromFile(chain, governanceAddress)
    const governanceInstance = new Contract(governanceAddress, abi, customProvider(chain))

    const name = await governanceInstance.callStatic.name()
    const prevVotingPeriod = (await governanceInstance.callStatic.votingPeriod()).toString()
    const newVotingPeriod = decodedParams[0]

    const changeInVotingPeriod = subtractFn(newVotingPeriod, prevVotingPeriod)

    return `The Voting Period (duration of voting on a proposal in terms of Ethereum blocks) of **[${name}](https://${platform}/address/${governanceAddress})** is changed from ${addCommas(
      prevVotingPeriod
    )} blocks to ${addCommas(newVotingPeriod)} blocks ${getChangeTextFn(changeInVotingPeriod)}`
  },
  'acceptOwnership()': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = getPlatform(chain)
    const contractAddress = transaction.target

    const { contractName } = await getContractNameAndAbiFromFile(chain, contractAddress)

    return `Accept ownership of **[${contractName}](https://${platform}/address/${contractAddress})**.`
  },
  'resume()': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = getPlatform(chain)
    const contractAddress = transaction.target

    const { contractName } = await getContractNameAndAbiFromFile(chain, contractAddress)

    return `Resume the **[${contractName}](https://${platform}/address/${contractAddress})**, allowing the guardian to start rebalancing.`
  },
  'deposit(tuple[])': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = getPlatform(chain)
    const contractAddress = transaction.target
    const tuple = decodedParams[0].split(',')
    const depositedAssets = await formatCoinsAndAmounts(tuple, chain, platform)
    const { contractName } = await getContractNameAndAbiFromFile(chain, contractAddress)

    return `🛑 Deposit **${depositedAssets}** into **[${contractName}](https://${platform}/address/${contractAddress})**.`
  },
}
