import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from '../compound-types'

export const publicResolverFormatter: { [functionName: string]: TransactionFormatter } = {
  'setText(bytes32,string,string)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const ENSSubdomain =
      decodedParams[0] === '0x7dcf87198fd673716e5a32b206d9379c4fcbad8875073f52bfd0656759bf89ed'
        ? 'v3-additional-grants.compound-community-licenses.eth'
        : 'Unknown ENS Name'

    const jsonValue = JSON.parse(decodedParams[2])
    const formattedJsonValue = JSON.stringify(jsonValue, null, 2)

    return `Set ENS text for ${ENSSubdomain} with key: ${decodedParams[1]} and value:\n\`\`\`json\n${formattedJsonValue}\n\`\`\``
  },
}
