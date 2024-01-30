import { Contract } from 'ethers'
import { customProvider } from '../../../utils/clients/ethers'
import { getContractNameAndAbiFromFile } from './../abi-utils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from './../compound-types'
import { defactor, getPlatform } from './helper'

export const generalFormatters: { [functionName: string]: TransactionFormatter } = {
  'transfer(address,uint256)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    console.log(`decodedParams ${decodedParams.join(',')}`)
    const platform = await getPlatform(chain)

    const { abi } = await getContractNameAndAbiFromFile(chain, transaction.target)
    const currentInstance = new Contract(transaction.target, abi, customProvider(chain))
    const symbol = await currentInstance.callStatic.symbol()
    const decimals = await currentInstance.callStatic.decimals()
    const compToken = defactor(BigInt(decodedParams[1]), parseFloat(`1e${decimals}`))

    return `\n\nTransfer ${compToken.toFixed(2)} [${symbol}](https://${platform}/address/${transaction.target}) to ${
      decodedParams[0]
    }.`
  },
}
