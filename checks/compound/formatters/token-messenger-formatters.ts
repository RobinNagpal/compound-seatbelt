import { getContractNameAndAbiFromFile } from '../abi-utils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from '../compound-types'
import { addCommas, getContractSymbolAndDecimalsFromFile, getPlatform } from './helper'
import { customProvider } from './../../../utils/clients/ethers'
import { defactorFn } from './../../../utils/roundingUtils'
import { hexStripZeros } from '@ethersproject/bytes'
import { Contract } from 'ethers'

export const tokenMessengerFormatters: { [functionName: string]: TransactionFormatter } = {
  'depositForBurn(uint256,uint32,bytes32,address)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = getPlatform(chain)

    const { contractName } = await getContractNameAndAbiFromFile(chain, transaction.target)

    const burnContractAddress = decodedParams[3]
    const { abi } = await getContractNameAndAbiFromFile(chain, burnContractAddress)
    const tokenInstance = new Contract(burnContractAddress, abi, customProvider(chain))
    const { symbol: tokenSymbol, decimals } = await getContractSymbolAndDecimalsFromFile(burnContractAddress, tokenInstance, chain)

    const normalized = hexStripZeros(decodedParams[2])

    const amount = defactorFn(decodedParams[0], `${decimals}`)

    return `Set DepositforBurn of ${contractName} for the Burn contract **[${tokenSymbol}](https://${platform}/address/${burnContractAddress})** with amount ${addCommas(
      amount
    )}, destination domain ${decodedParams[1]} and the Mint recipient **${normalized}**`
  },
}
