import { getContractNameAndAbiFromFile } from '../abi-utils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from '../compound-types'
import { addressFormatter, getContractNameWithLink, getContractSymbolAndDecimalsFromFile, getIcon, getPlatform, IconType } from './helper'
import { customProvider } from './../../../utils/clients/ethers'
import { Contract } from 'ethers'

export const cometProxyAdminFormatters: { [functionName: string]: TransactionFormatter } = {
  'deployAndUpgradeTo(address,address)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const contractNameWithLink = await getContractNameWithLink(decodedParams[0], chain)

    const { abi } = await getContractNameAndAbiFromFile(chain, decodedParams[1])
    const currentCometInstance = new Contract(decodedParams[1], abi, customProvider(chain))

    const baseToken = await currentCometInstance.callStatic.baseToken()
    const { abi: baseTokenAbi } = await getContractNameAndAbiFromFile(chain, baseToken)
    const baseTokenInstance = new Contract(baseToken, baseTokenAbi, customProvider(chain))
    const { symbol } = await getContractSymbolAndDecimalsFromFile(baseToken, baseTokenInstance, chain)

    const details = `${getIcon(IconType.Update)} Deploy and upgrade new implementation for **${addressFormatter(baseToken, chain, symbol)}** via ${contractNameWithLink}.`
    return { summary: details, details }
  },
  'changeProxyAdmin(address,address)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const contractNameWithLink = await getContractNameWithLink(decodedParams[0], chain)
    
    const details = `${getIcon(IconType.Update)} Change Proxy Admin of ${contractNameWithLink} to ${addressFormatter(decodedParams[1], chain)}.`
    return {summary: details, details}
  },
  'upgrade(address,address)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const contractNameWithLink = await getContractNameWithLink(decodedParams[0], chain)
    
    const details = `${getIcon(IconType.Update)} Upgrade the implementation of ${contractNameWithLink} to ${addressFormatter(decodedParams[1], chain)}.`
    return {summary: details, details}
  }
}
