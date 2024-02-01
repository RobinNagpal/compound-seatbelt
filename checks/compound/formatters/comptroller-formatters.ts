import { Contract } from 'ethers'
import { customProvider } from '../../../utils/clients/ethers'
import { getContractNameAndAbiFromFile } from './../abi-utils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from './../compound-types'
import { calculateDifferenceOfDecimals, defactor, getContractSymbolAndDecimalsFromFile, getPlatform } from './helper'

export const comptrollerFormatters: { [functionName: string]: TransactionFormatter } = {
  '_grantComp(address,uint256)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    console.log(`decodedParams ${decodedParams.join(',')}`)
    const platform = await getPlatform(chain)

    let { contractName } = await getContractNameAndAbiFromFile(chain, decodedParams[0])

    contractName = contractName === '' ? 'Wallet' : contractName

    const { abi } = await getContractNameAndAbiFromFile(chain, transaction.target)
    const currentInstance = new Contract(transaction.target, abi, customProvider(chain))

    const compAddress = await currentInstance.callStatic.getCompAddress()
    const { abi: compAddressAbi } = await getContractNameAndAbiFromFile(chain, compAddress)
    const compInstance = new Contract(compAddress, compAddressAbi, customProvider(chain))
    const { symbol } = await getContractSymbolAndDecimalsFromFile(compAddress, compInstance, chain)

    const compToken = defactor(BigInt(decodedParams[1]))

    return `\n\nGrant **${compToken.toFixed(
      2
    )} [${symbol}](https://${platform}/address/${compAddress})** tokens to [${contractName}](https://${platform}/address/${
      decodedParams[0]
    }).`
  },
  '_setCompSpeeds(address[],uint256[],uint256[])': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    console.log(`decodedParams ${decodedParams.join(',')}`)

    const platform = await getPlatform(chain)

    const { abi } = await getContractNameAndAbiFromFile(chain, decodedParams[0])
    const currentInstance = new Contract(decodedParams[0], abi, customProvider(chain))
    const { symbol } = await getContractSymbolAndDecimalsFromFile(decodedParams[0], currentInstance, chain)

    const { abi: targetAbi } = await getContractNameAndAbiFromFile(chain, transaction.target)
    const currentTargetInstance = new Contract(transaction.target, targetAbi, customProvider(chain))

    const compAddress = await currentTargetInstance.callStatic.getCompAddress()
    const { abi: compAddressAbi } = await getContractNameAndAbiFromFile(chain, compAddress)
    const compInstance = new Contract(compAddress, compAddressAbi, customProvider(chain))
    const { symbol: compSymbol } = await getContractSymbolAndDecimalsFromFile(compAddress, compInstance, chain)

    const prevCompBorrowSpeed = defactor(await currentTargetInstance.callStatic.compBorrowSpeeds(decodedParams[0]))
    const prevCompSupplySpeed = defactor(await currentTargetInstance.callStatic.compSupplySpeeds(decodedParams[0]))

    const newCompBorrowSpeed = defactor(BigInt(decodedParams[1]))
    const newCompSupplySpeed = defactor(BigInt(decodedParams[2]))

    const changeInSupply = calculateDifferenceOfDecimals(newCompSupplySpeed, prevCompSupplySpeed)
    const changeInBorrow = calculateDifferenceOfDecimals(newCompBorrowSpeed, prevCompBorrowSpeed)

    return `\n\nSet CompSpeed of [${symbol}](https://${platform}/address/${
      decodedParams[0]
    }) to ${newCompSupplySpeed.toFixed(
      3
    )} [${compSymbol}](https://${platform}/address/${compAddress})/block (supply) which was previously ${prevCompSupplySpeed.toFixed(
      3
    )} and now getting ${
      changeInSupply > 0 ? 'increased' : 'decreased'
    } by **${changeInSupply}%** and ${newCompBorrowSpeed.toFixed(
      3
    )} [${compSymbol}](https://${platform}/address/${compAddress})/block (borrow) which was previously ${prevCompBorrowSpeed.toFixed(
      3
    )} and now getting ${changeInBorrow > 0 ? 'increased' : 'decreased'} by **${changeInBorrow}%**.`
  },
  '_setCollateralFactor(address,uint256)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    console.log(`decodedParams ${decodedParams.join(',')}`)
    const platform = await getPlatform(chain)

    const { abi } = await getContractNameAndAbiFromFile(chain, decodedParams[0])
    const coinInstance = new Contract(decodedParams[0], abi, customProvider(chain))

    const { symbol } = await getContractSymbolAndDecimalsFromFile(decodedParams[0], coinInstance, chain)

    const token = defactor(BigInt(decodedParams[1]))
    const tokenInPercent = token * 100

    return `\n\nSet [${symbol}](https://${platform}/address/${
      decodedParams[0]
    }) collateral factor to ${tokenInPercent.toFixed(1)}%`
  },
  '_setMarketBorrowCaps(address[],uint256[])': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    console.log(`decodedParams ${decodedParams.join(',')}`)
    const platform = await getPlatform(chain)

    const { abi } = await getContractNameAndAbiFromFile(chain, decodedParams[0])
    const currentInstance = new Contract(decodedParams[0], abi, customProvider(chain))

    const { symbol } = await getContractSymbolAndDecimalsFromFile(decodedParams[0], currentInstance, chain)

    const { abi: contractAbi } = await getContractNameAndAbiFromFile(chain, transaction.target)
    const contractInstance = new Contract(transaction.target, contractAbi, customProvider(chain))

    const prevValue = await contractInstance.callStatic.borrowCaps(decodedParams[0])
    const newValue = Number(decodedParams[1])

    const changeinCaps = calculateDifferenceOfDecimals(newValue, prevValue)

    return `\n\nSet MarketBorrowCaps of [${symbol}](https://${platform}/address/${
      decodedParams[0]
    }) to ${newValue}. Previous value was ${prevValue} and now it is getting ${
      changeinCaps > 0 ? 'increased' : 'decreased'
    } by **${changeinCaps}**.`
  },
}
