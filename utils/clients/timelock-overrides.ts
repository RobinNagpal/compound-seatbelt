import { defaultAbiCoder } from '@ethersproject/abi'
import { BigNumber, BigNumberish } from '@ethersproject/bignumber'
import { HashZero } from '@ethersproject/constants'
import { keccak256 } from '@ethersproject/keccak256'
import { toUtf8Bytes } from '@ethersproject/strings'
import { hashOperationBatchOz } from '../contracts/governor'

export interface TimelockOverrideParams {
  targets: string[]
  values: BigNumberish[]
  signatures: string[]
  calldatas: string[]
  timestamp: BigNumber
  description?: string
  governorType: 'bravo' | 'oz'
}

/**
 * @notice Generates timelock state overrides
 * @param params Parameters for timelock overrides
 */
export async function generateTimelockOverrides(params: TimelockOverrideParams): Promise<Record<string, string>> {
  const { targets, values, signatures, calldatas, timestamp, description, governorType } = params

  // Compute transaction hashes used by the Timelock
  const txHashes = targets.map((target, i) => {
    return keccak256(
      defaultAbiCoder.encode(
        ['address', 'uint256', 'string', 'bytes', 'uint256'],
        [target, values[i], signatures[i], calldatas[i], timestamp],
      ),
    )
  })

  // Generate the timelock storage overrides
  const timelockStorageObj: Record<string, string> = {}
  txHashes.forEach((hash) => {
    timelockStorageObj[`queuedTransactions[${hash}]`] = 'true'
  })

  // For OZ governors, add timestamp entry
  if (governorType === 'oz' && description) {
    const id = hashOperationBatchOz(targets, values, calldatas, HashZero, keccak256(toUtf8Bytes(description)))
    timelockStorageObj[`_timestamps[${id.toHexString()}]`] = timestamp.toString()
  }

  return timelockStorageObj
}
