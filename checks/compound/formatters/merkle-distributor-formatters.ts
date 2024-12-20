import { getContractNameAndAbiFromFile } from '../abi-utils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from '../compound-types'
import { addCommas, addressFormatter, getContractNameWithLink, getContractSymbolAndDecimalsFromFile, getIcon, IconType, tab } from './helper'
import { customProvider } from './../../../utils/clients/ethers'
import { defactorFn } from './../../../utils/roundingUtils'
import { Contract } from 'ethers'

export const merkleDistributorFormatters: { [functionName: string]: TransactionFormatter } = {
  'fund()': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const distributorAddress = transaction.target
    const { abi: distributorAbi, contractName: distributorName } = await getContractNameAndAbiFromFile(chain, distributorAddress)
    const distributorInstance = new Contract(distributorAddress, distributorAbi, customProvider(chain))

    const funderAddress = await distributorInstance.callStatic.funder()
    const funderContractNameWithLink = await getContractNameWithLink(funderAddress, chain)
    const isFunded = await distributorInstance.callStatic.isFunded()

    const tokenAddress = await distributorInstance.callStatic.token()
    const { abi: tokenAbi } = await getContractNameAndAbiFromFile(chain, tokenAddress)
    const tokenInstance = new Contract(tokenAddress, tokenAbi, customProvider(chain))
    const { symbol: tokenSymbol, decimals } = await getContractSymbolAndDecimalsFromFile(tokenAddress, tokenInstance, chain)

    const fundingAmountRaw = (await distributorInstance.callStatic.fundingAmount()).toString()
    const fundingAmount = defactorFn(fundingAmountRaw, `${decimals}`)
    const normalizedChange = `**${addressFormatter(distributorAddress, chain, distributorName)}** is getting funded`
    const fundAmountWithToken = `**${addCommas(fundingAmount)} ${addressFormatter(tokenAddress, chain, tokenSymbol)}**`
    const alreadyFunded = isFunded
      ? `but ${addressFormatter(distributorAddress, chain, distributorName)} has already been funded by ${funderContractNameWithLink}`
      : '.'
    
    const icon = isFunded ? getIcon(IconType.Attention) : getIcon(IconType.Money)
    const details = `${icon} ${normalizedChange} ${fundAmountWithToken} by ${funderContractNameWithLink} ${alreadyFunded}\n\n${tab}**Raw Changes:** Fund ${fundingAmountRaw} to ${distributorAddress}`
    const summary = `${icon} Fund ${addressFormatter(distributorAddress, chain, distributorName)} with ${addCommas(fundingAmount)} ${addressFormatter(tokenAddress, chain, tokenSymbol)} ${isFunded? 'but its already funded':''}`
    return {summary, details}
  },
}
