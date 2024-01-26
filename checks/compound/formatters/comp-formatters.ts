import { getContractNameAndAbiFromFile } from './../abi-utils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from './../compound-types'
import { BigNumber } from '@ethersproject/bignumber'
import { constants } from 'ethers'

export const compFormatters: { [functionName: string]: TransactionFormatter } = {
  'approve(address,uint256)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    const { contractName } = await getContractNameAndAbiFromFile(chain, decodedParams[0])
    const divisor = constants.WeiPerEther
    const amount = BigNumber.from(decodedParams[1]).div(divisor)
    return `Grant **${amount} COMP** to **${contractName}**`
  },
  'transfer(address,uint256)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    const { contractName } = await getContractNameAndAbiFromFile(chain, decodedParams[0])
    const divisor = constants.WeiPerEther
    const amount = BigNumber.from(decodedParams[1]).div(divisor)
    return `Transfer **${amount} COMP** to **${contractName}**`
  },
}
