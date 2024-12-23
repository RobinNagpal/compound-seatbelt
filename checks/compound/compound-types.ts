import { Message } from '@/types'
import { BigNumber } from '@ethersproject/bignumber'

export interface ExecuteTransactionsInfo {
  targets: string[]
  signatures: string[]
  calldatas: string[]
  values: BigNumber[]
}

export interface ExecuteTransactionInfo {
  target: string
  signature: string
  calldata: string
  value?: BigNumber
}

export interface TargetLookupData {
  [address: string]: {
    contractName: string
    functions: {
      [functionName: string]: {
        description: string
        transactionFormatter: string
        proposals: {
          [proposalNumber: string]: string[]
        }
      }
    }
    proposals: number[]
  }
}

export interface ContractTypeFormattingInfo {
  transactionFormatter: string
  functions: {
    [functionName: string]: {
      transactionFormatter: string
    }
  }
}

export interface TargetTypeLookupData {
  [contractName: string]: ContractTypeFormattingInfo
}

export interface TransactionMessage {
  info?: string
  warning?: string
  error?: string
}

export enum CometChains {
  arbitrum = 'arbitrum',
  polygon = 'polygon',
  mainnet = 'mainnet',
  base = 'base',
  scroll = 'scroll',
  optimism = 'optimism',
  mantle = 'mantle',
}

export type TransactionFormatter = (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => Promise<string | ActionAnalysis>

export interface ContractNameAndAbi {
  contractName: string
  abi: any[]
}

export interface SymbolAndDecimalsLookupData {
  [address: string]: {
    symbol: string
    decimals: string
  }
}

export interface ActionAnalysis {
  summary: string
  details: string
}

export interface ChainedProposalAnalysis {
  chain: CometChains
  actionAnalysis: ActionAnalysis[]
}

export interface GovernanceProposalAnalysis {
  mainnetActionAnalysis: ActionAnalysis[]
  chainedProposalAnalysis: ChainedProposalAnalysis[]
}

export type ProposalActionResponse = ActionAnalysis
