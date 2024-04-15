import { getContractNameAndAbiFromFile } from '../abi-utils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from '../compound-types'
import { Contract } from 'ethers'
import { customProvider } from './../../../utils/clients/ethers'
import diff from 'deep-diff'

export const publicResolverFormatter: { [functionName: string]: TransactionFormatter } = {
  'setText(bytes32,string,string)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const ENSSubdomain =
      decodedParams[0] === '0x7dcf87198fd673716e5a32b206d9379c4fcbad8875073f52bfd0656759bf89ed'
        ? 'v3-additional-grants.compound-community-licenses.eth'
        : 'Unknown ENS Name'

    const { abi: targetAbi } = await getContractNameAndAbiFromFile(chain, transaction.target)
    const targetInstance = new Contract(transaction.target, targetAbi, customProvider(chain))

    const prevtext = await targetInstance.callStatic.text(decodedParams[0], decodedParams[1])
    const changes = summarizeChanges(prevtext, decodedParams[2])

    const formattedJsonValue = JSON.stringify(changes.message ?? changes, null, 2)
    return `Set ENS text for ${ENSSubdomain} with key: ${decodedParams[1]} and value modification:\n\`\`\`json\n${formattedJsonValue}\n\`\`\``
  },
}

interface DiffResult {
  Added?: string[]
  Updated?: string[]
  Deleted?: string[]
  message?: string
}

function summarizeChanges(oldJsonStr: string, newJsonStr: string): DiffResult {
  const oldJson = JSON.parse(oldJsonStr)
  const newJson = JSON.parse(newJsonStr)

  const result: DiffResult = {}
  const difference = diff(oldJson, newJson)

  if (!difference) {
    result.message = 'No Change.'
    return result
  }

  difference.forEach((change) => {
    const path = change.path ? change.path.join('.') : ''
    switch (change.kind) {
      case 'N':
        if (!result.Added) result.Added = []
        result.Added.push(`'${path}': ${JSON.stringify(change.rhs)}`)
        break
      case 'E':
        if (!result.Updated) result.Updated = []
        result.Updated.push(`'${path}': from ${JSON.stringify(change.lhs)} to ${JSON.stringify(change.rhs)}`)
        break
      case 'D':
        if (!result.Deleted) result.Deleted = []
        result.Deleted.push(`'${path}': ${JSON.stringify(change.lhs)}`)
        break
    }
  })
  return result
}
