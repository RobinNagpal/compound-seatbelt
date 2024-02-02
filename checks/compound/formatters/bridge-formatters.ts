import { getContractNameAndAbiFromFile } from './../abi-utils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from './../compound-types'
import { getFormattedTokenWithLink } from './helper'

export const bridgeFormatters: { [functionName: string]: TransactionFormatter } = {
  'depositFor(address,address,bytes)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    console.log(`chain ${chain}`)
    console.log(`transaction ${JSON.stringify(transaction, null, 2)}`)
    console.log(`decodedParams ${decodedParams.join(',')}`)

    if (transaction.target === '0xa0c68c638235ee32657e8f720a23cec1bfc77c77') {
      const [recipient, token, amount] = decodedParams
      let { contractName: recipientName } = await getContractNameAndAbiFromFile(CometChains.polygon, recipient)
      if (recipientName !== 'CometRewards') {
        recipientName = recipient
      }
      const formattedTokenWithLink = await getFormattedTokenWithLink(CometChains.mainnet, token, amount)
      return `Deposit ${formattedTokenWithLink} to [${recipientName}](https://polygonscan.com/address/${recipient}) on Polygon.`
    }

    throw new Error('Unknown bridge contract')
  },
}
