import { Contract } from 'ethers'
import { getContractNameAndAbiFromFile } from '../abi-utils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from '../compound-types'
import { customProvider } from './../../../utils/clients/ethers'
import { defactorFn } from './../../../utils/roundingUtils'
import { addCommas, addressFormatter, getContractSymbolAndDecimalsFromFile, getRecipientNameWithLink } from './helper'

export const cometFormatters: { [functionName: string]: TransactionFormatter } = {
  'withdrawReserves(address,uint256)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const [recepient, valueToTransfer] = decodedParams
    const { abi: contractAbi } = await getContractNameAndAbiFromFile(chain, transaction.target)
    const contractInstance = new Contract(transaction.target, contractAbi, customProvider(chain))

    const baseToken = await contractInstance.callStatic.baseToken()
    const { abi: baseTokenAbi } = await getContractNameAndAbiFromFile(chain, baseToken)
    const baseTokenInstance = new Contract(baseToken, baseTokenAbi, customProvider(chain))
    const { symbol, decimals } = await getContractSymbolAndDecimalsFromFile(baseToken, baseTokenInstance, chain)

    const amount = defactorFn(valueToTransfer, `${decimals}`)

    return `🛑 Withdraw **${addCommas(amount)} ${addressFormatter(baseToken, chain, symbol)}** to ${recepient}.`
  },
}
