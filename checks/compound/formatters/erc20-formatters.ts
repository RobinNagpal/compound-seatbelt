import { hexZeroPad, hexStripZeros } from '@ethersproject/bytes'
import { Contract } from 'ethers'

import { customProvider } from '../../../utils/clients/ethers'
import { getContractNameAndAbiFromFile } from '../abi-utils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from '../compound-types'
import {
  calculateDifferenceOfDecimals,
  defactor,
  getContractSymbolAndDecimalsFromFile,
  getFormattedTokenNameWithLink,
  getFormattedTokenWithLink,
  getPercentageForTokenFactor,
  getPlatform,
  getRecipientNameWithLink,
} from './helper'

// @ts-ignore
import namehash from '@ensdomains/eth-ens-namehash'

export const ERC20Formatters: { [functionName: string]: TransactionFormatter } = {
  'transfer(address,uint256)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    const platform = await getPlatform(chain)

    const coinAddress = transaction.target
    const { abi } = await getContractNameAndAbiFromFile(chain, coinAddress)
    const tokenInstance = new Contract(coinAddress, abi, customProvider(chain))
    const { symbol, decimals } = await getContractSymbolAndDecimalsFromFile(coinAddress, tokenInstance, chain)

    const amount = defactor(BigInt(decodedParams[1]), parseFloat(`1e${decimals}`))

    return `\n\nTransfer **${amount.toFixed(
      2
    )} [${symbol}](https://${platform}/address/${coinAddress})** to ${getRecipientNameWithLink(
      chain,
      decodedParams[0]
    )}.`
  },
  'approve(address,uint256)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    const tokenAddress = transaction.target
    const formattedTokenWithLink = await getFormattedTokenWithLink(chain, tokenAddress, decodedParams[1])
    return `\n\nApprove ${formattedTokenWithLink} tokens to ${getRecipientNameWithLink(chain, decodedParams[0])}`
  },
  '_setReserveFactor(uint256)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    const tokenAddress = transaction.target
    const { abi } = await getContractNameAndAbiFromFile(chain, tokenAddress)
    const coinInstance = new Contract(tokenAddress, abi, customProvider(chain))
    const prevReserveFactor = await coinInstance.callStatic.reserveFactorMantissa()

    const newReserveFactor = getPercentageForTokenFactor(decodedParams[0])

    const tokenNameWithLink = await getFormattedTokenNameWithLink(chain, tokenAddress)
    const prevReserve = getPercentageForTokenFactor(prevReserveFactor)
    if (prevReserveFactor && prevReserve !== newReserveFactor) {
      return `\n\nSet reserve factor for ${tokenNameWithLink} from ${prevReserve}% to ${newReserveFactor}%`
    }

    return `\n\nSet reserve factor for ${tokenNameWithLink} to ${newReserveFactor}%`
  },
  'depositForBurn(uint256,uint32,bytes32,address)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    const platform = await getPlatform(chain)

    const { contractName } = await getContractNameAndAbiFromFile(chain, transaction.target)

    const burnContractAddress = decodedParams[3]
    const { abi } = await getContractNameAndAbiFromFile(chain, burnContractAddress)
    const tokenInstance = new Contract(burnContractAddress, abi, customProvider(chain))
    const { symbol: tokenSymbol, decimals } = await getContractSymbolAndDecimalsFromFile(
      burnContractAddress,
      tokenInstance,
      chain
    )

    const normalized = hexStripZeros(decodedParams[2])

    const amount = defactor(BigInt(decodedParams[0]), parseFloat(`1e${decimals}`))

    return `\n\nSet DepositforBurn of ${contractName} for the Burn contract [${tokenSymbol}](https://${platform}/address/${burnContractAddress}) with amount ${amount.toFixed(
      2
    )}, destination domain ${decodedParams[1]} and the Mint recipient ${normalized}`
  },
  'setText(bytes32,string,string)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    const ENSSubdomain =
      decodedParams[0] === '0x7dcf87198fd673716e5a32b206d9379c4fcbad8875073f52bfd0656759bf89ed'
        ? 'v3-additional-grants.compound-community-licenses.eth'
        : 'Unknown ENS Name'
    return `\n\nSet ENS text for ${ENSSubdomain} with key: ${decodedParams[1]} and value:\n\n ${decodedParams[2]}`
  },
  'setSubnodeRecord(bytes32,bytes32,address,address,uint64)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    const platform = await getPlatform(chain)

    const { contractName: ownerName } = await getContractNameAndAbiFromFile(chain, decodedParams[2])
    const { contractName: resolverName } = await getContractNameAndAbiFromFile(chain, decodedParams[3])

    const ENSName = 'compound-community-licenses.eth'
    const ENSSubdomainLabel = 'v3-additional-grants'
    return `\n\nCreate new ${ENSSubdomainLabel} ENS subdomain for ${ENSName} with [${ownerName}](https://${platform}/address/${decodedParams[2]}) as owner and [${resolverName}](https://${platform}/address/${decodedParams[3]}) as resolver and ttl = ${decodedParams[4]}`
  },
  '_setInterestRateModel(address)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    const platform = await getPlatform(chain)

    const coinLink = await getFormattedTokenNameWithLink(chain, transaction.target)

    return `\n\nSet [interest rate model](https://${platform}/address/${decodedParams[0]}) for ${coinLink}.`
  },
  '_reduceReserves(uint256)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    const platform = await getPlatform(chain)

    const cTokenAddress = transaction.target
    const { abi: cTokenAbi } = await getContractNameAndAbiFromFile(chain, cTokenAddress)
    const cTokenInstance = new Contract(cTokenAddress, cTokenAbi, customProvider(chain))
    const { symbol: cTokenSymbol, decimals: cTokenDecimals } = await getContractSymbolAndDecimalsFromFile(
      cTokenAddress,
      cTokenInstance,
      chain
    )

    const underlyingAssetAddress = await cTokenInstance.callStatic.underlying()
    const totalReserves = await cTokenInstance.callStatic.totalReserves()

    const { abi: assetAbi } = await getContractNameAndAbiFromFile(chain, underlyingAssetAddress)
    const assetInstance = new Contract(underlyingAssetAddress, assetAbi, customProvider(chain))
    const { symbol: assetSymbol, decimals: assetDecimals } = await getContractSymbolAndDecimalsFromFile(
      underlyingAssetAddress,
      assetInstance,
      chain
    )

    const totalReservesFormatted = defactor(totalReserves, parseFloat(`1e${cTokenDecimals}`))
    const reduceValue = defactor(BigInt(decodedParams[0]), parseFloat(`1e${assetDecimals}`))

    const totalReservesNew = calculateDifferenceOfDecimals(totalReservesFormatted, reduceValue)

    return `\n\nReduce reserves of [${cTokenSymbol}](https://${platform}/address/${cTokenAddress}) by ${reduceValue.toFixed(
      2
    )} [${assetSymbol}](https://${platform}/address/${underlyingAssetAddress}). Remaining total reserves would be ${totalReservesNew.toFixed(
      2
    )}`
  },
  'redeem(uint256)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = await getPlatform(chain)

    const cTokenAddress = transaction.target
    const { abi: cTokenAbi } = await getContractNameAndAbiFromFile(chain, cTokenAddress)
    const cTokenInstance = new Contract(cTokenAddress, cTokenAbi, customProvider(chain))
    const { symbol: cTokenSymbol, decimals: cTokenDecimals } = await getContractSymbolAndDecimalsFromFile(
      cTokenAddress,
      cTokenInstance,
      chain
    )

    const underlyingAssetAddress = await cTokenInstance.callStatic.underlying()

    const { abi: assetAbi } = await getContractNameAndAbiFromFile(chain, underlyingAssetAddress)
    const assetInstance = new Contract(underlyingAssetAddress, assetAbi, customProvider(chain))
    const { symbol: assetSymbol, decimals: assetDecimals } = await getContractSymbolAndDecimalsFromFile(
      underlyingAssetAddress,
      assetInstance,
      chain
    )

    const cTokens = defactor(BigInt(decodedParams[0]), parseFloat(`1e${cTokenDecimals}`))
    const underlyingAssetTokens = defactor(BigInt(decodedParams[0]), parseFloat(`1e${assetDecimals}`))

    return `\n\nRedeem ${cTokens} [${cTokenSymbol}](https://${platform}/address/${transaction.target}) cTokens in exchange for ${underlyingAssetTokens} [${assetSymbol}](https://${platform}/address/${underlyingAssetAddress})`
  },
  'migrateFromLegacyReputationToken()': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    const platform = await getPlatform(chain)
    const newTokenAddress = transaction.target
    const { abi: newTokenAbi } = await getContractNameAndAbiFromFile(chain, newTokenAddress)
    const newTokenInstance = new Contract(newTokenAddress, newTokenAbi, customProvider(chain))
    const { symbol: newTokenSymbol } = await getContractSymbolAndDecimalsFromFile(
      newTokenAddress,
      newTokenInstance,
      chain
    )
    const legacyTokenAddress = await newTokenInstance.callStatic.legacyRepToken()
    const legacyTokenLink = await getFormattedTokenNameWithLink(chain, legacyTokenAddress)
    return `\n\nMigrate the balance of legacy reputation token ${legacyTokenLink} to new reputation token [${newTokenSymbol}](https://${platform}/address/${transaction.target}).`
  },
}
