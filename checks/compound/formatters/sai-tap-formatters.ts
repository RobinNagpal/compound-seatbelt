import { getContractNameAndAbiFromFile } from '../abi-utils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from '../compound-types'
import { addCommas, getContractSymbolAndDecimalsFromFile, getPlatform, getRecipientNameWithLink } from './helper'
import { customProvider } from './../../../utils/clients/ethers'
import { defactorFn, multiplyFn } from './../../../utils/roundingUtils'
import { Contract } from 'ethers'

export const saiTapFormatters: { [functionName: string]: TransactionFormatter } = {
  'cash(uint256)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = getPlatform(chain)
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

    return `Cash **${addCommas(saiAmount)} [${tokenSymbol}](https://${platform}/address/${saiAddress})** into collateral **${addCommas(
      collateralAmount
    )} [${collateralSymbol}](https://${platform}/address/${gemAddress})** and send to ${getRecipientNameWithLink(chain, targetAddress)}`
  },
}
