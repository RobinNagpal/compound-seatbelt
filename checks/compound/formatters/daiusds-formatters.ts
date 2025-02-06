import { defactorFn } from './../../../utils/roundingUtils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from '../compound-types'
import { Contract } from 'ethers'
import { getContractNameAndAbiFromFile } from '../abi-utils'
import { customProvider } from './../../../utils/clients/ethers'
import { addCommas, addressFormatter, getContractSymbolAndDecimalsFromFile, getIcon, getRecipientNameWithLink, IconType } from './helper'

export const daiusdsFormatters: { [functionName: string]: TransactionFormatter } = {
  'daiToUsds(address,uint256)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const { abi: targetAbi } = await getContractNameAndAbiFromFile(chain, transaction.target)
    const targetInstance = new Contract(transaction.target, targetAbi, customProvider(chain))

    const daiToken = await targetInstance.callStatic.dai()
    const { abi: daiAbi } = await getContractNameAndAbiFromFile(chain, daiToken)
    const daiInstance = new Contract(daiToken, daiAbi, customProvider(chain))

    const { decimals: daiDecimals } = await getContractSymbolAndDecimalsFromFile(daiToken, daiInstance, chain)

    console.log(`Chain: ${chain}, daiToken: ${daiToken}, decodedParams[0]: ${decodedParams[0]}`)

    const defactoredAmount = defactorFn(decodedParams[1], `${daiDecimals}`)

    const details = `${getIcon(IconType.Convert)} Convert ${addCommas(defactoredAmount)} DAI to USDS with 1:1 ratio and transfer USDS to ${addressFormatter(decodedParams[0], chain)} market.`
    return { summary: details, details }
  },
}
