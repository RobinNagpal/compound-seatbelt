import { getContractNameAndAbiFromFile } from '../abi-utils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from '../compound-types'
import { addCommas, addressFormatter, getContractNameWithLink, getContractSymbolAndDecimalsFromFile, getPlatform } from './helper'
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

    const fundingAmount = defactorFn((await distributorInstance.callStatic.fundingAmount()).toString(), `${decimals}`)
    const normalizedChange = `**${addressFormatter(distributorAddress, chain, distributorName)}** is getting funded`
    const fundAmountWithToken = `**${addCommas(fundingAmount)} ${addressFormatter(tokenAddress, chain, tokenSymbol)}**`
    const alreadyFunded = isFunded
      ? `but ${addressFormatter(distributorAddress, chain, distributorName)} has already been funded by ${funderContractNameWithLink}`
      : '.'

    return `🛑 ${normalizedChange} ${fundAmountWithToken} by ${funderContractNameWithLink} ${alreadyFunded}`
  },
}
