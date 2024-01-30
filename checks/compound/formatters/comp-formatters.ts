import { getContractNameAndAbiFromFile } from './../abi-utils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from './../compound-types'
import { BigNumber } from '@ethersproject/bignumber'
import { Contract, constants } from 'ethers'
import { defactor, getPlatform } from './helper'
import { customProvider } from '../../../utils/clients/ethers'

export const compFormatters: { [functionName: string]: TransactionFormatter } = {
  'approve(address,uint256)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    console.log(`decodedParams ${decodedParams.join(',')}`)
    const platform = await getPlatform(chain)

    const { contractName } = await getContractNameAndAbiFromFile(chain, decodedParams[0])

    const { abi: compAddressAbi } = await getContractNameAndAbiFromFile(chain, transaction.target)
    const compInstance = new Contract(transaction.target, compAddressAbi, customProvider(chain))
    const symbol = await compInstance.callStatic.symbol()

    const compToken = defactor(BigInt(decodedParams[1]))

    return `\n\nApprove **${compToken.toFixed(2)} ${symbol}** tokens to [${contractName}](https://${platform}/address/${
      decodedParams[0]
    })`
  },
}
