import { Contract } from 'ethers'
import { customProvider } from '../../../utils/clients/ethers'
import { getContractNameAndAbiFromFile } from '../../compound/abi-utils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from '../../compound/compound-types'
import { addressFormatter, getContractSymbolAndDecimalsFromFile, getFormattedTokenNameWithLink, getPlatform } from './helper'

export const reputationTokenFormatters: { [functionName: string]: TransactionFormatter } = {
  'migrateFromLegacyReputationToken()': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const newTokenAddress = transaction.target
    const { abi: newTokenAbi } = await getContractNameAndAbiFromFile(chain, newTokenAddress)
    const newTokenInstance = new Contract(newTokenAddress, newTokenAbi, customProvider(chain))
    const { symbol: newTokenSymbol } = await getContractSymbolAndDecimalsFromFile(newTokenAddress, newTokenInstance, chain)
    const legacyTokenAddress = await newTokenInstance.callStatic.legacyRepToken()
    const legacyTokenLink = await getFormattedTokenNameWithLink(chain, legacyTokenAddress)
    const newTokenLink = addressFormatter(transaction.target, chain, newTokenSymbol)
    return `Migrate the balance of legacy reputation token ${legacyTokenLink} to new reputation token **${newTokenLink}**.`
  },
}
