import { BigNumber } from 'ethers'
import { getContractNameAndAbiFromFile } from '../abi-utils'
import { CometChains, ExecuteTransactionInfo, TransactionFormatter } from '../compound-types'
import { addressFormatter, formatCoinsAndAmounts, getContractNameWithLink, getFormattedTokenNameWithLink, getIcon, getPlatform, getRecipientNameWithLink, IconType } from './helper'
import { Interface } from '@ethersproject/abi'
import { generateAISummary } from '../aiSummary'
import { defactorFn } from './../../../utils/roundingUtils'

export const aeraVaultFormatters: { [functionName: string]: TransactionFormatter } = {
  'acceptOwnership()': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const contractNameWithLink = await getContractNameWithLink(transaction.target, chain)
    const details = `${getIcon(IconType.Add)} Accept ownership of ${contractNameWithLink}.`
    return { summary: details, details }
  },
  'deposit(tuple[])': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const tuple = decodedParams[0].split(',')
    const depositedAssets = await formatCoinsAndAmounts(tuple, chain)
    const contractNameWithLink = await getContractNameWithLink(transaction.target, chain)

    const details = `${getIcon(IconType.Money)} Deposit ${depositedAssets} into ${contractNameWithLink}.`
    return { summary: details, details }
  },
  'resume()': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const contractNameWithLink = await getContractNameWithLink(transaction.target, chain)

    const details = `${getIcon(IconType.Unpause)} Resume fee accrual and guardian submissions of the ${contractNameWithLink} contract, allowing the guardian to start re-balancing.`
    return { summary: details, details }
  },
  'setHooks(address)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const targetContractNameWithLink = await getContractNameWithLink(transaction.target, chain)
    const newHookNameWithLink = await getContractNameWithLink(decodedParams[0], chain)
    
    const details = `${getIcon(IconType.Update)} Update the hooks module of ${targetContractNameWithLink} to ${newHookNameWithLink}.`
    return { summary: details, details }
  },
  'setGuardianAndFeeRecipient(address,address)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const targetContractNameWithLink = await getContractNameWithLink(transaction.target, chain)
    const guardianLink = addressFormatter(decodedParams[0], chain)
    const feeRecipientLink = addressFormatter(decodedParams[1], chain)
    
    const details = `${getIcon(IconType.Update)} Update the guardian of ${targetContractNameWithLink} to ${guardianLink} and fee recipient to ${feeRecipientLink}.`
    return { summary: details, details }
  },
  'addAsset(tuple)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const targetContractNameWithLink = await getContractNameWithLink(transaction.target, chain)
    const tuple = decodedParams[0].split(',')
    const assetAddress = tuple[0]
    
    const assetNameWithLink = await getFormattedTokenNameWithLink(chain, assetAddress)
    const decodedUpdateFrequency = decodeUpdateFrequency(parseInt(tuple[1]))
    const isERC4626 = tuple[2] == 'true'
    
    const functionDesc = `${getIcon(IconType.Add)} Add ${isERC4626 ? 'yield-bearing asset': 'asset'} ${assetNameWithLink} to ${targetContractNameWithLink}`
    const details = `${functionDesc} with update frequency of ${decodedUpdateFrequency} and oracle ${addressFormatter(tuple[3],chain)}.`
    return { summary: functionDesc, details }
  },
  'removeAsset(address)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const targetContractNameWithLink = await getContractNameWithLink(transaction.target, chain)
    
    const assetNameWithLink = await getFormattedTokenNameWithLink(chain, decodedParams[0])
    
    const details = `${getIcon(IconType.Delete)} Remove asset ${assetNameWithLink} from ${targetContractNameWithLink}.`
    return { summary: details, details }
  },
  'execute(tuple)': async (chain: CometChains, transaction: ExecuteTransactionInfo, decodedParams: string[]) => {
    const targetContractNameWithLink = await getContractNameWithLink(transaction.target, chain)
    
    const tuple = decodedParams[0].split(',')
    const executeTarget = tuple[0]
    
    const decoded = await decodedCalldata(chain, executeTarget, tuple[2])
    
    const value = decoded.value
    let transferDetails = ''
    if (value && value !== '0') {
      transferDetails = ` and Transfer **${defactorFn(value)} ETH** to ${await getRecipientNameWithLink(chain, executeTarget)}.`
    }
    
    const decodedTransaction = await generateAISummary(chain, executeTarget, decoded.signature, decoded.argsArray, true)
    const functionDesc = `Execute a transaction via the ${targetContractNameWithLink}`
    const details = `${functionDesc}:\n ${decodedTransaction}${transferDetails}`
    
    return { summary: functionDesc, details }
  },
}

function decodeUpdateFrequency(heartbeat: number): string {
  const secondsInADay = 86400;
  const secondsInAnHour = 3600;
  const secondsInAMinute = 60;

  if (heartbeat % secondsInADay === 0) {
    const days = heartbeat / secondsInADay;
    return `${days} day${days > 1 ? 's' : ''}`;
  } else if (heartbeat % secondsInAnHour === 0) {
    const hours = heartbeat / secondsInAnHour;
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  } else if (heartbeat % secondsInAMinute === 0) {
    const minutes = heartbeat / secondsInAMinute;
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  } else {
    return `${heartbeat} second${heartbeat > 1 ? 's' : ''}`;
  }
}

async function decodedCalldata(chain: CometChains, target: string, calldata: string) {
  const contractNameAndAbi = await getContractNameAndAbiFromFile(chain, target)
  
    if (!contractNameAndAbi.abi) {
      console.log('No ABI found for address:', target)
      throw new Error('No ABI found for address ' + target)
    }
    const iface = new Interface(contractNameAndAbi.abi)
    
    const decoded = iface.parseTransaction({ data: calldata });
    
    const signature = decoded.signature;
    const argsArray = decoded.args.map((arg) =>
      arg._isBigNumber ? BigNumber.from(arg._hex).toString() : arg
    );
    const value = BigNumber.from(decoded.value._hex).toString()
    
    return {signature, argsArray, value}
}