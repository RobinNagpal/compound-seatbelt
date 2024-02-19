import { Contract } from 'ethers'
import { getContractNameAndAbiFromFile } from '../abi-utils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from './../compound-types'
import { calculateDifferenceOfDecimals, formatCoinsAndAmounts, getChangeText, getContractSymbolAndDecimalsFromFile, getPlatform } from './helper'
import { customProvider } from '../../../utils/clients/ethers'

export const governorBravoFormatters: { [functionName: string]: TransactionFormatter } = {
  '_setProposalThreshold(uint256)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = getPlatform(chain)

    const governanceAddress = transaction.target
    const { abi } = await getContractNameAndAbiFromFile(chain, governanceAddress)
    const governanceInstance = new Contract(governanceAddress, abi, customProvider(chain))

    const name = await governanceInstance.callStatic.name()

    const prevThreshold = parseFloat(await governanceInstance.callStatic.proposalThreshold())
    const newThreshold = parseFloat(decodedParams[0])

    const changeInThreshold = calculateDifferenceOfDecimals(newThreshold, prevThreshold)

    return `Set proposal threshold of [${name}](https://${platform}/address/${
      transaction.target
    }) from **${prevThreshold.toLocaleString()}** to **${newThreshold.toLocaleString()}** ${getChangeText(changeInThreshold)}`
  },
  '_setWhitelistGuardian(address)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = getPlatform(chain)

    const governanceAddress = transaction.target
    const { abi } = await getContractNameAndAbiFromFile(chain, governanceAddress)
    const governanceInstance = new Contract(governanceAddress, abi, customProvider(chain))

    const name = await governanceInstance.callStatic.name()
    const { contractName: guardianContractName } = await getContractNameAndAbiFromFile(chain, decodedParams[0])

    return `Set the Whitelist Guardian of [${name}](https://${platform}/address/${governanceAddress}) to [${guardianContractName}](https://${platform}/address/${decodedParams[0]}).`
  },
  '_setVotingDelay(uint256)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = getPlatform(chain)

    const governanceAddress = transaction.target
    const { abi } = await getContractNameAndAbiFromFile(chain, governanceAddress)
    const governanceInstance = new Contract(governanceAddress, abi, customProvider(chain))

    const name = await governanceInstance.callStatic.name()
    const prevVotingDelay = await governanceInstance.callStatic.votingDelay()
    const newVotingDelay = parseFloat(decodedParams[0])

    const changeInVotingDelay = await calculateDifferenceOfDecimals(newVotingDelay, prevVotingDelay)

    return `Number of Ethereum blocks to wait before voting on a proposal may begin (Voting Delay) for [${name}](https://${platform}/address/${governanceAddress}) is changed from **${prevVotingDelay}** blocks to **${newVotingDelay}** blocks ${getChangeText(
      changeInVotingDelay
    )}`
  },
  '_setVotingPeriod(uint256)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = getPlatform(chain)

    const governanceAddress = transaction.target
    const { abi } = await getContractNameAndAbiFromFile(chain, governanceAddress)
    const governanceInstance = new Contract(governanceAddress, abi, customProvider(chain))

    const name = await governanceInstance.callStatic.name()
    const prevVotingPeriod = await governanceInstance.callStatic.votingPeriod()
    const newVotingPeriod = parseFloat(decodedParams[0])

    const changeInVotingPeriod = await calculateDifferenceOfDecimals(newVotingPeriod, prevVotingPeriod)

    return `The duration of voting on a proposal in terms of Ethereum blocks (Voting Period) of [${name}](https://${platform}/address/${governanceAddress}) is changed from **${prevVotingPeriod}** blocks to **${newVotingPeriod}** blocks ${getChangeText(
      changeInVotingPeriod
    )}`
  },
  'acceptOwnership()': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = getPlatform(chain)
    const contractAddress = transaction.target

    const { contractName } = await getContractNameAndAbiFromFile(chain, contractAddress)

    return `Accept ownership of [${contractName}](https://${platform}/address/${contractAddress}).`
  },
  'resume()': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = getPlatform(chain)
    const contractAddress = transaction.target

    const { contractName } = await getContractNameAndAbiFromFile(chain, contractAddress)

    return `Resume the [${contractName}](https://${platform}/address/${contractAddress}), allowing the guardian to start rebalancing.`
  },
  'deposit(tuple[])': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = getPlatform(chain)
    const contractAddress = transaction.target
    const tuple = decodedParams[0].split(',')
    const depositedAssets = await formatCoinsAndAmounts(tuple, chain, platform)
    const { contractName } = await getContractNameAndAbiFromFile(chain, contractAddress)

    return `🛑 Deposit ${depositedAssets} into [${contractName}](https://${platform}/address/${contractAddress}).`
  },
}
