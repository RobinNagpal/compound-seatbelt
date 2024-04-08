import { getContractNameAndAbiFromFile } from '../abi-utils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from '../compound-types'
import { getContractNameWithLink, getPlatform } from './helper'

export const ensRegistryWithFallbackFormatters: { [functionName: string]: TransactionFormatter } = {
  'setSubnodeRecord(bytes32,bytes32,address,address,uint64)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const ownerContractNameWithLink = await getContractNameWithLink(decodedParams[2], chain)
    const resolverContractNameWithLink = await getContractNameWithLink(decodedParams[3], chain)

    const ENSName = 'compound-community-licenses.eth'
    const ENSSubdomainLabel = 'v3-additional-grants'
    return `Create new ${ENSSubdomainLabel} ENS subdomain for ${ENSName} with ${ownerContractNameWithLink} as owner and ${resolverContractNameWithLink} as resolver and ttl = ${decodedParams[4]}`
  },
}
