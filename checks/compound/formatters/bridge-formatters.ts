import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from './../compound-types'
import { getFormattedTokenWithLink, getRecipientNameWithLink } from './helper'

export const bridgeFormatters: { [functionName: string]: TransactionFormatter } = {
  'depositFor(address,address,bytes)': async (
    chain: CometChains,
    transaction: ExecuteTransactionInfo,
    decodedParams: string[]
  ) => {
    if (transaction.target === '0xa0c68c638235ee32657e8f720a23cec1bfc77c77') {
      const [recipient, token, amount] = decodedParams

      const formattedTokenWithLink = await getFormattedTokenWithLink(CometChains.mainnet, token, amount)
      const recipientWithLink = getRecipientNameWithLink(CometChains.polygon, recipient)
      return `\n\n Deposit ${formattedTokenWithLink} to ${recipientWithLink} on Polygon.`
    }

    throw new Error('Unknown bridge contract')
  },
}
