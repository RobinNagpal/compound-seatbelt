import { getContractNameAndAbiFromFile } from '../abi-utils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from '../compound-types'
import { addressFormatter, getContractSymbolAndDecimalsFromFile, getPlatform } from './helper'
import { customProvider } from './../../../utils/clients/ethers'
import { Contract } from 'ethers'

export const cometRewardsFormatters: { [functionName: string]: TransactionFormatter } = {
  'setRewardConfig(address,address)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const { abi } = await getContractNameAndAbiFromFile(chain, decodedParams[0])
    const currentInstance = new Contract(decodedParams[0], abi, customProvider(chain))

    const baseToken = await currentInstance.callStatic.baseToken()
    const { abi: baseTokenAbi } = await getContractNameAndAbiFromFile(chain, baseToken)
    const baseTokenInstance = new Contract(baseToken, baseTokenAbi, customProvider(chain))
    const { symbol: tokenSymbol } = await getContractSymbolAndDecimalsFromFile(baseToken, baseTokenInstance, chain)

    const { abi: compAbi } = await getContractNameAndAbiFromFile(chain, decodedParams[1])
    const compInstance = new Contract(decodedParams[1], compAbi, customProvider(chain))
    const { symbol } = await getContractSymbolAndDecimalsFromFile(decodedParams[1], compInstance, chain)

    return `⚠️ Set reward token for market **${addressFormatter(baseToken, chain, tokenSymbol)}** as **${addressFormatter(decodedParams[1], chain, symbol)}**.`
  },
}
