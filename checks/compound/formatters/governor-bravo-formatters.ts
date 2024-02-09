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
    }) to ${newThreshold.toLocaleString()}. Previous value was ${prevThreshold.toLocaleString()} and ${getChangeText(
      changeInThreshold
    )}.`
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
}
