import { Contract } from 'ethers'
import { customProvider } from '../../../utils/clients/ethers'
import { getContractNameAndAbiFromFile } from '../abi-utils'
import { defactorFn } from './../../../utils/roundingUtils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from './../compound-types'
import { addCommas, addressFormatter, getContractSymbolAndDecimalsFromFile, getIcon, getPlatform, getRecipientNameWithLink, IconType } from './helper'

export const bridgeFormatters: { [functionName: string]: TransactionFormatter } = {
  'depositFor(address,address,bytes)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const icon = getIcon(IconType.Bridge)
    
    if (transaction.target === '0xa0c68c638235ee32657e8f720a23cec1bfc77c77') {
      const [recipient, token, amount] = decodedParams

      const { abi: compAddressAbi } = await getContractNameAndAbiFromFile(chain, token)
      const compInstance = new Contract(token, compAddressAbi, customProvider(chain))
      const { symbol, decimals } = await getContractSymbolAndDecimalsFromFile(token, compInstance, chain)
      const defactoredAmount = defactorFn(amount, `${decimals}`)
      const recipientWithLink = await getRecipientNameWithLink(CometChains.polygon, recipient)
      
      const details = `${icon} Bridge **${addCommas(defactoredAmount)} ${addressFormatter(token, chain, symbol)}** tokens over Polygon to ${recipientWithLink}.`
      
      return {summary: details, details}
    }

    throw new Error('Unknown bridge contract')
  },

  'depositERC20To(address,address,address,uint256,uint32,bytes)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const [localToken, remoteToken, toAddress, amount] = decodedParams

    const { abi: compAddressAbi } = await getContractNameAndAbiFromFile(chain, localToken)
    const compInstance = new Contract(localToken, compAddressAbi, customProvider(chain))
    const { symbol, decimals } = await getContractSymbolAndDecimalsFromFile(localToken, compInstance, chain)
    const defactoredAmount = defactorFn(amount, `${decimals}`)

    const icon = getIcon(IconType.Bridge)
    
    if (transaction.target === '0x3154cf16ccdb4c6d922629664174b904d80f2c35') {
      const recipientWithLink = await getRecipientNameWithLink(CometChains.base, toAddress)
      const details = `${icon} Bridge **${addCommas(defactoredAmount)} ${addressFormatter(localToken, chain, symbol)}** tokens over Base to ${recipientWithLink}.`
      return {summary: details, details}
    } else if (transaction.target === '0x99c9fc46f92e8a1c0dec1b1747d010903e884be1') {
      const recipientWithLink = await getRecipientNameWithLink(CometChains.optimism, toAddress)
      const details = `${icon} Bridge **${addCommas(defactoredAmount)} ${addressFormatter(localToken, chain, symbol)}** tokens over Optimism to ${recipientWithLink}.`
      return {summary: details, details}
    } else if (transaction.target === '0x95fc37a27a2f68e3a647cdc081f0a89bb47c3012') {
      const recipientWithLink = await getRecipientNameWithLink(CometChains.optimism, toAddress)
      const details = `${icon} Bridge **${addCommas(defactoredAmount)} ${addressFormatter(localToken, chain, symbol)}** tokens over Mantle to ${recipientWithLink}.`
      return {summary: details, details}
    }

    throw new Error('Unknown bridge contract')
  },
  'depositETHTo(address,uint32,bytes)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const icon = getIcon(IconType.Bridge)

    if (transaction.target === '0x3154cf16ccdb4c6d922629664174b904d80f2c35') {
      const recipent = await getRecipientNameWithLink(chain, decodedParams[0])
      const details = `${icon} Bridge **${defactorFn(transaction.value ? transaction.value.toString() : '')} ETH** on Base to ${recipent}.`
      return {summary: details, details}
    }

    throw new Error('Unknown bridge contract')
  },
  'outboundTransferCustomRefund(address,address,address,uint256,uint256,uint256,bytes)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    const icon = getIcon(IconType.Bridge)

    if (transaction.target === '0x72ce9c846789fdb6fc1f34ac4ad25dd9ef7031ef') {
      const tokenAddress = decodedParams[0]
      const { abi: tokenAbi } = await getContractNameAndAbiFromFile(chain, tokenAddress)
      const tokenInstance = new Contract(tokenAddress, tokenAbi, customProvider(chain))
      const { symbol: tokenSymbol, decimals: tokenDecimals } = await getContractSymbolAndDecimalsFromFile(tokenAddress, tokenInstance, chain)
      const amount = defactorFn(decodedParams[3], `${tokenDecimals}`)
      const recipientWithLink = await getRecipientNameWithLink(CometChains.arbitrum, decodedParams[2])

      const details = `${icon} Bridge **${addCommas(amount)} ${addressFormatter(tokenAddress, chain, tokenSymbol)}** tokens over Arbitrum to ${recipientWithLink}.`
      return {summary: details, details}
    }
    throw new Error('Unknown bridge contract')
  },
}
