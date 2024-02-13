import { Contract } from 'ethers'
import { getContractNameAndAbiFromFile } from '../abi-utils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from './../compound-types'
import {
  calculateDifferenceOfDecimals,
  getChangeText,
  getContractSymbolAndDecimalsFromFile,
  getPlatform,
} from './helper'
import { customProvider } from '../../../utils/clients/ethers'

export const governorBravoFormatters: { [functionName: string]: TransactionFormatter } = {
  '_setProposalThreshold(uint256)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    const platform = await getPlatform(chain)

    const governanceAddress = transaction.target
    const { abi } = await getContractNameAndAbiFromFile(chain, governanceAddress)
    const governanceInstance = new Contract(governanceAddress, abi, customProvider(chain))

    const name = await governanceInstance.callStatic.name()

    const prevThreshold = parseFloat(await governanceInstance.callStatic.proposalThreshold())
    const newThreshold = parseFloat(decodedParams[0])

    const changeInThreshold = calculateDifferenceOfDecimals(newThreshold, prevThreshold)

    return `\n\nSet proposal threshold of [${name}](https://${platform}/address/${
      transaction.target
    }) to ${newThreshold.toLocaleString()}. Previous value was ${prevThreshold.toLocaleString()} ${getChangeText(
      changeInThreshold
    )}`
  },
  '_setWhitelistGuardian(address)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    const platform = await getPlatform(chain)

    const governanceAddress = transaction.target
    const { abi } = await getContractNameAndAbiFromFile(chain, governanceAddress)
    const governanceInstance = new Contract(governanceAddress, abi, customProvider(chain))

    const name = await governanceInstance.callStatic.name()
    const { contractName: guardianContractName } = await getContractNameAndAbiFromFile(chain, decodedParams[0])

    return `\n\nSet the Whitelist Guardian of [${name}](https://${platform}/address/${governanceAddress}) to [${guardianContractName}](https://${platform}/address/${decodedParams[0]}).`
  },
  '_setVotingDelay(uint256)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    const platform = await getPlatform(chain)

    const governanceAddress = transaction.target
    const { abi } = await getContractNameAndAbiFromFile(chain, governanceAddress)
    const governanceInstance = new Contract(governanceAddress, abi, customProvider(chain))

    const name = await governanceInstance.callStatic.name()
    const prevVotingDelay = await governanceInstance.callStatic.votingDelay()
    const newVotingDelay = parseFloat(decodedParams[0])

    const changeInVotingDelay = await calculateDifferenceOfDecimals(newVotingDelay, prevVotingDelay)

    return `\n\nNumber of Ethereum blocks to wait before voting on a proposal may begin (Voting Delay) for [${name}](https://${platform}/address/${governanceAddress}) is set to ${newVotingDelay} blocks. Previous value was ${prevVotingDelay} blocks ${getChangeText(
      changeInVotingDelay
    )}`
  },
  '_setVotingPeriod(uint256)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    const platform = await getPlatform(chain)

    const governanceAddress = transaction.target
    const { abi } = await getContractNameAndAbiFromFile(chain, governanceAddress)
    const governanceInstance = new Contract(governanceAddress, abi, customProvider(chain))

    const name = await governanceInstance.callStatic.name()
    const prevVotingPeriod = await governanceInstance.callStatic.votingPeriod()
    const newVotingPeriod = parseFloat(decodedParams[0])

    const changeInVotingPeriod = await calculateDifferenceOfDecimals(newVotingPeriod, prevVotingPeriod)

    return `\n\nThe duration of voting on a proposal in terms of Ethereum blocks (Voting Period) of [${name}](https://${platform}/address/${governanceAddress}) is set to ${newVotingPeriod} blocks. Previous value was ${prevVotingPeriod} blocks ${getChangeText(
      changeInVotingPeriod
    )}`
  },
}
