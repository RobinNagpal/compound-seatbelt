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
    return `Approve **${amount}** [COMP](https://etherscan.io/address/0xc00e94cb662c3520282e6f5717214004a7f26888) to **[${contractName}](https://etherscan.io/address/${decodedParams[0]})**`
  },
  'transfer(address,uint256)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    const divisor = constants.WeiPerEther
    const amount = BigNumber.from(decodedParams[1]).div(divisor)
    return `Transfer **${amount}** [COMP](https://etherscan.io/address/0xc00e94cb662c3520282e6f5717214004a7f26888) to [Wallet](https://etherscan.io/address/${decodedParams[0]})`
  },
}
