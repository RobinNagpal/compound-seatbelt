import { getContractNameAndAbiFromFile } from '../abi-utils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from '../compound-types'
import { addCommas, getContractSymbolAndDecimalsFromFile, getPlatform } from './helper'
import { customProvider } from './../../../utils/clients/ethers'
import { defactorFn } from './../../../utils/roundingUtils'
import { Contract } from 'ethers'

export const merkleDistributorFormatters: { [functionName: string]: TransactionFormatter } = {
  'fund()': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = getPlatform(chain)
    const distributorAddress = transaction.target
    const { abi: distributorAbi, contractName: distributorName } = await getContractNameAndAbiFromFile(chain, distributorAddress)
    const distributorInstance = new Contract(distributorAddress, distributorAbi, customProvider(chain))

    const funderAddress = await distributorInstance.callStatic.funder()
    const { contractName: funderName } = await getContractNameAndAbiFromFile(chain, funderAddress)
    const isFunded = await distributorInstance.callStatic.isFunded()

    const tokenAddress = await distributorInstance.callStatic.token()
    const { abi: tokenAbi } = await getContractNameAndAbiFromFile(chain, tokenAddress)
    const tokenInstance = new Contract(tokenAddress, tokenAbi, customProvider(chain))
    const { symbol: tokenSymbol, decimals } = await getContractSymbolAndDecimalsFromFile(tokenAddress, tokenInstance, chain)

    const fundingAmount = defactorFn((await distributorInstance.callStatic.fundingAmount()).toString(), `${decimals}`)

    return `🛑 **[${distributorName}](https://${platform}/address/${distributorAddress})** is getting funded **${addCommas(
      fundingAmount
    )} [${tokenSymbol}](https://${platform}/address/${tokenAddress})** by **[${funderName}](https://${platform}/address/${funderAddress})**${
      isFunded
        ? ` but [${distributorName}](https://${platform}/address/${distributorAddress}) has already been funded by [${funderName}](https://${platform}/address/${funderAddress})`
        : ''
    }.`
  },
}
