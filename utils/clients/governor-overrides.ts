import { BigNumber } from '@ethersproject/bignumber'
import { Contract, ethers } from 'ethers'
import { provider } from './ethers'

// New interfaces for governor overrides
export interface GovernorOverrideParams {
  proposalId: BigNumber | ArrayLike<number> | bigint | string | number
  governor: Contract
  eta: BigNumber
}

export interface ProposalCoreSlots {
  proposalCoreSlot: string
  etaSlot: string
  extendedTimelinesSlot: string
  againstVotesSlot: string
  forVotesSlot: string
}

export interface ProposalVoteValues {
  againstVotes: BigNumber
  forVotes: BigNumber
}

/**
 * Helper function to calculate proposal storage slots for OpenZeppelin governor
 * @param proposalId The ID of the proposal
 * @returns Object containing all relevant storage slots
 */
export function calculateProposalSlots(
  proposalId: BigNumber | ArrayLike<number> | bigint | string | number,
): ProposalCoreSlots {
  // Calculate base slots
  const GovernorStorageLocationBigNumber = BigNumber.from(
    '0x7c712897014dbe49c045ef1299aa2d5f9e67e48eea4403efa21f1e0f3ac0cb00',
  )

  // Add 1 to skip the first slot which is the governor's `string _name;` in GovernorStorage.
  const mappingBaseSlot = GovernorStorageLocationBigNumber.add(1).toHexString()

  // Calculate proposal core slot
  const proposalCoreSlot = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256'], [proposalId, mappingBaseSlot]),
  )

  // Calculate eta slot (next slot after proposal core)
  const etaSlot = ethers.BigNumber.from(proposalCoreSlot).add(1).toHexString()

  // Calculate extended timelines slot
  const GovernorPreventLateQuorumStorageLocationBigNumber = BigNumber.from(
    '0x042f525fd47e44d02e065dd7bb464f47b4f926fbd05b5e087891ebd756adf100',
  )

  // Skip uint48 _voteExtension in GovernorPreventLateQuorumStorage
  const extendedTimelinesBaseSlot = GovernorPreventLateQuorumStorageLocationBigNumber.add(1).toHexString()

  const extendedTimelinesSlot = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256'], [proposalId, extendedTimelinesBaseSlot]),
  )

  // Calculate proposal votes slots
  const GovernorCountingFractionalStorageLocation = '0xd073797d8f9d07d835a3fc13195afeafd2f137da609f97a44f7a3aa434170800'

  const proposalVotesBaseSlot = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ['uint256', 'uint256'],
      [proposalId, GovernorCountingFractionalStorageLocation],
    ),
  )

  const againstVotesSlot = proposalVotesBaseSlot
  const forVotesSlot = ethers.BigNumber.from(proposalVotesBaseSlot).add(1).toHexString()

  return {
    proposalCoreSlot,
    etaSlot,
    extendedTimelinesSlot,
    againstVotesSlot,
    forVotesSlot,
  }
}

/**
 * @notice Calculate and create state overrides for an OpenZeppelin governor
 * @param params Object containing proposalId, governor contract, and eta timestamp
 * @returns Record of storage slot addresses to values
 */
export async function getGovernorOverrides(params: GovernorOverrideParams): Promise<{ [x: string]: string }> {
  const { proposalId, governor, eta } = params

  // Calculate all the storage slots for this proposal
  const slots = calculateProposalSlots(proposalId)

  // Read current storage to get the proposer address
  console.log('Storage slot for proposalId:', slots.proposalCoreSlot)
  await readProposal(governor.address, slots.proposalCoreSlot)

  const currentValue = await provider.getStorageAt(governor.address, slots.proposalCoreSlot)
  console.log('Current Storage:', currentValue)

  // Extract proposer from current storage value (first 20 bytes)
  const proposer = '0x' + currentValue.slice(2, 42)

  // Create proposal core value
  const newProposalCoreValue = ethers.utils.solidityPack(
    ['uint8', 'uint8', 'uint32', 'uint48', 'address'],
    [
      0, // cancelled
      0, // executed
      0, // voteDuration
      1, // voteStart
      proposer,
    ],
  )

  console.log('Storage slot for etaSeconds (second slot):', slots.etaSlot)

  // Set vote values
  const voteValues: ProposalVoteValues = {
    againstVotes: BigNumber.from(0),
    forVotes: BigNumber.from(600000),
  }

  // Encode values for eta and votes
  const newEtaSlotEncodedValue = ethers.utils.hexZeroPad(ethers.BigNumber.from(eta).toHexString(), 32)
  const newExtendedValue = ethers.utils.solidityPack(['uint48'], [0])
  const newAgainstVotesValue = ethers.utils.hexZeroPad(voteValues.againstVotes.toHexString(), 32)
  const newForVotesValue = ethers.utils.hexZeroPad(voteValues.forVotes.toHexString(), 32)

  console.log('eta value', eta)
  console.log('New Storage Value:', newProposalCoreValue)
  console.log('New encoded etaSeconds:', newEtaSlotEncodedValue)

  // Assemble all storage overrides
  const governorOverrides = {
    [slots.proposalCoreSlot]: newProposalCoreValue,
    [slots.etaSlot]: newEtaSlotEncodedValue,
    [slots.extendedTimelinesSlot]: newExtendedValue,
    [slots.againstVotesSlot]: newAgainstVotesValue,
    [slots.forVotesSlot]: newForVotesValue,
  }

  return governorOverrides
}

// --- Helper methods ---
async function readProposal(contractAddress: string, slotKey: string) {
  // Read slot0 (contains proposer, voteStart, voteDuration, executed, canceled)
  const slot0 = await provider.getStorageAt(contractAddress, slotKey)
  // Read slot1 (contains etaSeconds)
  const slot1 = await provider.getStorageAt(contractAddress, ethers.BigNumber.from(slotKey).add(1).toHexString())

  // Convert hex string to byte array
  const bytes0 = ethers.utils.arrayify(slot0)
  const bytes1 = ethers.utils.arrayify(slot1)

  // Extract proposer
  const proposerBytes = bytes0.slice(12, 32)
  const proposer = ethers.utils.getAddress(ethers.utils.hexlify(proposerBytes))

  // Extract voteStart
  const voteStartBytes = bytes0.slice(6, 12)
  const voteStart = ethers.BigNumber.from(voteStartBytes)

  // Extract voteDuration
  const voteDurationBytes = bytes0.slice(2, 6)
  const voteDuration = ethers.BigNumber.from(voteDurationBytes)

  // Extract executed
  const executed = bytes0[1] !== 0

  // Extract canceled
  const canceled = bytes0[0] !== 0

  // Extract etaSeconds from slot1
  const etaSecondsBytes = bytes1.slice(26, 32)
  const etaSeconds = ethers.BigNumber.from(etaSecondsBytes)

  // Print out the decoded values
  console.log('Proposal Core Values:')
  console.log('Proposer:    ', proposer)
  console.log('voteStart:   ', voteStart.toString())
  console.log('voteDuration:', voteDuration.toString())
  console.log('Executed:    ', executed)
  console.log('Canceled:    ', canceled)
  console.log('etaSeconds:  ', etaSeconds.toString())
}
