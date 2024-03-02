import { hexStripZeros } from '@ethersproject/bytes'
import { Contract } from 'ethers'

import { customProvider } from '../../../utils/clients/ethers'
import { getContractNameAndAbiFromFile } from '../abi-utils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from '../compound-types'
import { addCommas, getContractSymbolAndDecimalsFromFile, getFormattedTokenNameWithLink, getPlatform, getRecipientNameWithLink } from './helper'
import { defactorFn, multiplyFn, percentageFn, subtractFn } from './../../../utils/roundingUtils'

// @ts-ignore
import namehash from '@ensdomains/eth-ens-namehash'

export const ERC20Formatters: { [functionName: string]: TransactionFormatter } = {
  'transfer(address,uint256)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = getPlatform(chain)

    const coinAddress = transaction.target
    const { abi } = await getContractNameAndAbiFromFile(chain, coinAddress)
    const tokenInstance = new Contract(coinAddress, abi, customProvider(chain))
    const { symbol, decimals } = await getContractSymbolAndDecimalsFromFile(coinAddress, tokenInstance, chain)

    const amount = defactorFn(decodedParams[1], `${decimals}`)

    return `🛑 Transfer **${addCommas(amount)} [${symbol}](https://${platform}/address/${coinAddress})** to ${getRecipientNameWithLink(
      chain,
      decodedParams[0]
    )}.`
  },
  'approve(address,uint256)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = getPlatform(chain)

    const tokenAddress = transaction.target
    const { abi } = await getContractNameAndAbiFromFile(chain, tokenAddress)
    const tokenInstance = new Contract(tokenAddress, abi, customProvider(chain))
    const { symbol, decimals } = await getContractSymbolAndDecimalsFromFile(tokenAddress, tokenInstance, chain)

    const amount = defactorFn(decodedParams[1], `${decimals}`)

    return `🛑 Approve **${addCommas(amount)} [${symbol}](https://${platform}/address/${tokenAddress})** tokens to ${getRecipientNameWithLink(
      chain,
      decodedParams[0]
    )}`
  },

  'setSubnodeRecord(bytes32,bytes32,address,address,uint64)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = getPlatform(chain)

    const { contractName: ownerName } = await getContractNameAndAbiFromFile(chain, decodedParams[2])
    const { contractName: resolverName } = await getContractNameAndAbiFromFile(chain, decodedParams[3])

    const ENSName = 'compound-community-licenses.eth'
    const ENSSubdomainLabel = 'v3-additional-grants'
    return `Create new ${ENSSubdomainLabel} ENS subdomain for ${ENSName} with **[${ownerName}](https://${platform}/address/${decodedParams[2]})** as owner and **[${resolverName}](https://${platform}/address/${decodedParams[3]})** as resolver and ttl = ${decodedParams[4]}`
  },
  'migrateFromLegacyReputationToken()': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = getPlatform(chain)
    const newTokenAddress = transaction.target
    const { abi: newTokenAbi } = await getContractNameAndAbiFromFile(chain, newTokenAddress)
    const newTokenInstance = new Contract(newTokenAddress, newTokenAbi, customProvider(chain))
    const { symbol: newTokenSymbol } = await getContractSymbolAndDecimalsFromFile(newTokenAddress, newTokenInstance, chain)
    const legacyTokenAddress = await newTokenInstance.callStatic.legacyRepToken()
    const legacyTokenLink = await getFormattedTokenNameWithLink(chain, legacyTokenAddress)
    return `Migrate the balance of legacy reputation token ${legacyTokenLink} to new reputation token **[${newTokenSymbol}](https://${platform}/address/${transaction.target})**.`
  },
}
