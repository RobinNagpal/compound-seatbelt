import { getContractNameAndAbiFromFile } from '../abi-utils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from '../compound-types'
import { getPlatform } from './helper'

export const ensRegistryWithFallbackFormatters: { [functionName: string]: TransactionFormatter } = {
  'setSubnodeRecord(bytes32,bytes32,address,address,uint64)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const platform = getPlatform(chain)

    const { contractName: ownerName } = await getContractNameAndAbiFromFile(chain, decodedParams[2])
    const { contractName: resolverName } = await getContractNameAndAbiFromFile(chain, decodedParams[3])

    const ENSName = 'compound-community-licenses.eth'
    const ENSSubdomainLabel = 'v3-additional-grants'
    return `Create new ${ENSSubdomainLabel} ENS subdomain for ${ENSName} with **[${ownerName}](https://${platform}/address/${decodedParams[2]})** as owner and **[${resolverName}](https://${platform}/address/${decodedParams[3]})** as resolver and ttl = ${decodedParams[4]}`
  },
}
