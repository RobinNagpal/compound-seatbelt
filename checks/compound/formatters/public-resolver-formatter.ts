import { getContractNameAndAbiFromFile } from '../abi-utils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from '../compound-types'
import { Contract } from 'ethers'
import { customProvider } from './../../../utils/clients/ethers'
import { diffString } from 'json-diff'

export const publicResolverFormatter: { [functionName: string]: TransactionFormatter } = {
  'setText(bytes32,string,string)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const ENSSubdomain =
      decodedParams[0] === '0x7dcf87198fd673716e5a32b206d9379c4fcbad8875073f52bfd0656759bf89ed'
        ? 'v3-additional-grants.compound-community-licenses.eth'
        : 'Unknown ENS Name'

    const { abi: targetAbi } = await getContractNameAndAbiFromFile(chain, transaction.target)
    const targetInstance = new Contract(transaction.target, targetAbi, customProvider(chain))

    const prevtext = await targetInstance.callStatic.text(decodedParams[0], decodedParams[1])
    const oldJsonStr = prevtext
    const newJsonStr = decodedParams[2]

    const oldJson = JSON.parse(oldJsonStr)
    const newJson = JSON.parse(newJsonStr)
    const changes = diffString(oldJson, newJson, { color: false, verbose: true })

    const jsonDiffChangeStr = `\n \`\`\`json\n${changes}\n\`\`\``

    return `Set ENS text for ${ENSSubdomain} with key: ${decodedParams[1]} and updates -  \n\n${jsonDiffChangeStr}`
  },
}
