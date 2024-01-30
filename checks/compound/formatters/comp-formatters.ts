import { getContractNameAndAbiFromFile } from './../abi-utils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from './../compound-types'
import { BigNumber } from '@ethersproject/bignumber'
import { Contract, constants } from 'ethers'
import { defactor, getPlatform } from './helper'
import { customProvider } from '../../../utils/clients/ethers'

export const compFormatters: { [functionName: string]: TransactionFormatter } = {}
