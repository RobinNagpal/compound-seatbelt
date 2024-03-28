import { getContractNameAndAbiFromFile } from '../abi-utils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from '../compound-types'
import { addCommas, addressFormatter, getContractNameWithLink, getContractSymbolAndDecimalsFromFile, getPlatform } from './helper'
import { customProvider } from './../../../utils/clients/ethers'
import { defactorFn } from './../../../utils/roundingUtils'
import { hexStripZeros } from '@ethersproject/bytes'
import { Contract } from 'ethers'

export const tokenMessengerFormatters: { [functionName: string]: TransactionFormatter } = {
  'depositForBurn(uint256,uint32,bytes32,address)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const contractNameWithLink = await getContractNameWithLink(transaction.target, chain)

    const burnContractAddress = decodedParams[3]
    const { abi } = await getContractNameAndAbiFromFile(chain, burnContractAddress)
    const tokenInstance = new Contract(burnContractAddress, abi, customProvider(chain))
    const { symbol: tokenSymbol, decimals } = await getContractSymbolAndDecimalsFromFile(burnContractAddress, tokenInstance, chain)

    const normalized = hexStripZeros(decodedParams[2])

    const amount = defactorFn(decodedParams[0], `${decimals}`)

    const functionDesc = `Set DepositforBurn of ${contractNameWithLink} for the Burn contract **${addressFormatter(burnContractAddress, chain, tokenSymbol)}**`
    const changeParameters = `with amount ${addCommas(amount)}, destination domain ${decodedParams[1]} and the Mint recipient **${normalized}**`

    return `${functionDesc} ${changeParameters}`
  },
}
