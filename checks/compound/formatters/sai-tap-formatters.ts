import { getContractNameAndAbiFromFile } from '../abi-utils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from '../compound-types'
import { addCommas, addressFormatter, getContractSymbolAndDecimalsFromFile, getPlatform, getRecipientNameWithLink } from './helper'
import { customProvider } from './../../../utils/clients/ethers'
import { defactorFn, multiplyFn } from './../../../utils/roundingUtils'
import { Contract } from 'ethers'

export const saiTapFormatters: { [functionName: string]: TransactionFormatter } = {
  'cash(uint256)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const targetAddress = transaction.target
    const { abi: targetAbi } = await getContractNameAndAbiFromFile(chain, targetAddress)
    const targetInstance = new Contract(targetAddress, targetAbi, customProvider(chain))

    const fix = defactorFn((await targetInstance.callStatic.fix()).toString())

    const saiAddress = await targetInstance.callStatic.sai()
    const { abi: tokenAbi } = await getContractNameAndAbiFromFile(chain, saiAddress)
    const tokenInstance = new Contract(saiAddress, tokenAbi, customProvider(chain))
    const { symbol: tokenSymbol, decimals: tokenDecimals } = await getContractSymbolAndDecimalsFromFile(saiAddress, tokenInstance, chain)
    const saiAmount = defactorFn(decodedParams[0], `${tokenDecimals}`)

    const collateralAmount = multiplyFn(saiAmount, fix)

    const tubAddress = await targetInstance.callStatic.tub()
    const { abi: tubAbi } = await getContractNameAndAbiFromFile(chain, tubAddress)
    const tubInstance = new Contract(tubAddress, tubAbi, customProvider(chain))
    const gemAddress = await tubInstance.callStatic.gem()
    const { abi: gemAbi } = await getContractNameAndAbiFromFile(chain, gemAddress)
    const gemInstance = new Contract(gemAddress, gemAbi, customProvider(chain))
    const { symbol: collateralSymbol } = await getContractSymbolAndDecimalsFromFile(gemAddress, gemInstance, chain)

    const cashAmountText = `**${addCommas(saiAmount)} ${addressFormatter(saiAddress, chain, tokenSymbol)}**`
    const collateralAmountText = `**${addCommas(collateralAmount)} ${addressFormatter(gemAddress, chain, collateralSymbol)}**`

    return `Cash ${cashAmountText} into collateral ${collateralAmountText} and send to ${await getRecipientNameWithLink(chain, targetAddress)}`
  },
}
