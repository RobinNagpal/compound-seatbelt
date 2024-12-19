import { getContractNameAndAbiFromFile } from '../abi-utils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from '../compound-types'
import { addCommas, addressFormatter, getContractNameWithLink, getContractSymbolAndDecimalsFromFile, getIcon, getPlatform, IconType, tab } from './helper'
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

    const amountRaw = decodedParams[0]
    const amount = defactorFn(amountRaw, `${decimals}`)

    const functionDesc = `Update DepositforBurn of ${contractNameWithLink} for the Burn contract **${addressFormatter(burnContractAddress, chain, tokenSymbol)}**`
    const changeParameters = `with amount ${addCommas(amount)}, destination domain ${decodedParams[1]} and the Mint recipient **${normalized}**`
    const rawChanges = `amount ${amountRaw}, destination domain ${decodedParams[1]}, Mint recipient ${decodedParams[2]}`

    const icon = getIcon(IconType.Update)
    const details = `${icon} ${functionDesc} ${changeParameters}\n\n${tab}**Raw Changes:** ${rawChanges}`
    const summary = `${icon} ${functionDesc}.`
    return { summary, details }
  },
}
