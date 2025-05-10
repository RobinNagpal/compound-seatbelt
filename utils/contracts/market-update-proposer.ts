import { BigNumber, BigNumberish, Contract } from 'ethers'
import { timelock } from './timelock'
import { ProposalEvent, ProposalStruct } from '../../types'
import { JsonRpcProvider } from '@ethersproject/providers'

const MARKET_UPDATE_PROPOSER_ABI = [
  'event MarketUpdateProposalCreated(uint256 id, address proposer, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, string description)',
  'event MarketUpdateProposalExecuted(uint256 id)',
  'event MarketUpdateProposalCancelled(uint256 id)',
  'event SetProposalGuardian(address indexed oldProposalGuardian, address indexed newProposalGuardian)',
  'event SetMarketAdmin(address indexed oldAdmin, address indexed newAdmin)',
  'event SetGovernor(address indexed oldGovernor, address indexed newGovernor)',
  'function INITIAL_PROPOSAL_ID() view returns (uint256)',
  'function PROPOSAL_MAX_OPERATIONS() view returns (uint256)',
  'function governor() view returns (address)',
  'function proposalGuardian() view returns (address)',
  'function marketAdmin() view returns (address)',
  'function timelock() view returns (address)',
  'function proposalCount() view returns (uint256)',
  'function proposals(uint256) view returns (uint256 id, address proposer, uint256 eta, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, bool canceled, bool executed)',
  'function setGovernor(address newGovernor)',
  'function setProposalGuardian(address newProposalGuardian)',
  'function setMarketAdmin(address newMarketAdmin)',
  'function propose(address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, string description) returns (uint256)',
  'function execute(uint256 proposalId) payable',
  'function cancel(uint256 proposalId)',
  'function state(uint256 proposalId) view returns (uint8)',
  'function getProposal(uint256 proposalId) view returns (uint256, address, uint256, address[], uint256[], string[], bytes[], bool, bool)',
]

export const marketUpdateProposer = (address: string, provider: JsonRpcProvider) =>
  new Contract(address, MARKET_UPDATE_PROPOSER_ABI, provider)

// All possible states a proposal might be in.
// These are defined by the `ProposalState` enum so when we fetch the state of a proposal ID
// we receive an integer response, and use this to map that integer to the state
export const PROPOSAL_STATES = {
  '0': 'Canceled',
  '1': 'Queued',
  '2': 'Executed',
  '3': 'Expired',
}

export function getProposer(address: string, provider: JsonRpcProvider) {
  return marketUpdateProposer(address, provider)
}

export async function getProposal(
  address: string,
  proposalId: BigNumberish,
  provider: JsonRpcProvider,
): Promise<ProposalStruct> {
  const proposer = getProposer(address, provider)
  return proposer.proposals(proposalId)
}

export async function getTimelock(address: string, provider: JsonRpcProvider) {
  const proposer = getProposer(address, provider)
  return timelock(await proposer.timelock(), provider)
}

export async function getProposalIds(
  address: string,
  latestBlockNum: number,
  provider: JsonRpcProvider,
): Promise<BigNumber[]> {
  // Fetch all proposal IDs
  const proposer = marketUpdateProposer(address, provider)
  const proposalCreatedLogs = await proposer.queryFilter(
    proposer.filters.MarketUpdateProposalCreated(),
    0,
    latestBlockNum,
  )
  const allProposalIds = proposalCreatedLogs.map((logs) => (logs.args as unknown as ProposalEvent).id!)

  const initialProposalId = await proposer.INITIAL_PROPOSAL_ID()

  return allProposalIds.filter((id) => id.gt(initialProposalId!))
}

export function getProposalId(proposal: ProposalEvent): BigNumber {
  const id = proposal.id || proposal.proposalId
  if (!id) throw new Error(`Proposal ID not found for proposal: ${JSON.stringify(proposal)}`)
  return id
}

// Generate proposal ID, used when simulating new proposals.
export async function generateProposalId(address: string, provider: JsonRpcProvider): Promise<BigNumber> {
  // Fetch proposal count from the contract and increment it by 1.
  const count: BigNumber = await marketUpdateProposer(address, provider).proposalCount()
  return count.add(1)
}

export function formatProposalId(id: BigNumberish) {
  return BigNumber.from(id).toString()
}
