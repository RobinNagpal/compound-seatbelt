import { AbiCoder } from '@ethersproject/abi'
import { BigNumber } from '@ethersproject/bignumber'
import { getFunctionFragmentAndDecodedCalldata, getFunctionSignature } from './abi-utils'
import { CometChains, ExecuteTransactionInfo, ExecuteTransactionsInfo } from './compound-types'

export const l2Bridges: { [address: string]: CometChains } = {
  '0x4dbd4fc535ac27206064b68ffcf827b0a60bab3f': CometChains.arbitrum,
  '0xfe5e5d361b2ad62c541bab87c45a0b9b018389a2': CometChains.polygon,
  '0x866e82a600a1414e583f7f13623f1ac5d58b0afa': CometChains.base,
  '0x6774bcbd5cecef1336b5300fb5186a12ddd8b367': CometChains.scroll,
  '0x25ace71c97b33cc4729cf772ae268934f7ab5fa1': CometChains.optimism,
  '0x676a795fe6e43c17c668de16730c3f690feb7120': CometChains.mantle,
}

export async function getDecodedBytesForChain(
  chain: CometChains,
  proposalId: number,
  transactionInfo: ExecuteTransactionInfo
): Promise<ExecuteTransactionsInfo> {
  switch (chain) {
    case CometChains.arbitrum:
      return getDecodedBytesForArbitrum(proposalId, transactionInfo)
    case CometChains.base:
      return getDecodedBytesForBase(proposalId, transactionInfo)
    case CometChains.polygon:
      return getDecodedBytesForPolygon(proposalId, transactionInfo)
    case CometChains.scroll:
      return getDecodedBytesForScroll(proposalId, transactionInfo)
    case CometChains.optimism:
      return getDecodedBytesForOptimism(proposalId, transactionInfo)
    case CometChains.mantle:
      return getDecodedBytesForMantle(proposalId, transactionInfo)
    default:
      throw new Error(`Chain ${chain} is not supported`)
  }
}

export async function getDecodedBytesForArbitrum(proposalId: number, transactionInfo: ExecuteTransactionInfo): Promise<ExecuteTransactionsInfo> {
  const sentMessageSignature = 'createRetryableTicket(address,uint256,uint256,address,address,uint256,uint256,bytes)'
  const decodedCalldata = await getDecodedCallDataSentToBridge(proposalId, sentMessageSignature, transactionInfo)
  const parsedDataToBridge = decodedCalldata.at(7)
  return extractTransactionsFromBridgedData(parsedDataToBridge)
}

export async function getDecodedBytesForOptimism(proposalId: number, transactionInfo: ExecuteTransactionInfo): Promise<ExecuteTransactionsInfo> {
  const sentMessageSignature = 'sendMessage(address,bytes,uint32)'
  const decodedCalldata = await getDecodedCallDataSentToBridge(proposalId, sentMessageSignature, transactionInfo)
  const parsedDataToBridge = decodedCalldata.at(1)
  return extractTransactionsFromBridgedData(parsedDataToBridge)
}

export async function getDecodedBytesForMantle(proposalId: number, transactionInfo: ExecuteTransactionInfo): Promise<ExecuteTransactionsInfo> {
  const sentMessageSignature = 'sendMessage(address,bytes,uint32)'
  const decodedCalldata = await getDecodedCallDataSentToBridge(proposalId, sentMessageSignature, transactionInfo)
  const parsedDataToBridge = decodedCalldata.at(1)
  return extractTransactionsFromBridgedData(parsedDataToBridge)
}

export async function getDecodedBytesForBase(proposalId: number, transactionInfo: ExecuteTransactionInfo): Promise<ExecuteTransactionsInfo> {
  const sentMessageSignature = 'sendMessage(address,bytes,uint32)'
  const decodedCalldata = await getDecodedCallDataSentToBridge(proposalId, sentMessageSignature, transactionInfo)
  const parsedDataToBridge = decodedCalldata.at(1)
  return extractTransactionsFromBridgedData(parsedDataToBridge)
}

export async function getDecodedBytesForPolygon(proposalId: number, transactionInfo: ExecuteTransactionInfo): Promise<ExecuteTransactionsInfo> {
  const sentMessageSignature = 'sendMessageToChild(address,bytes)'
  const decodedCalldata = await getDecodedCallDataSentToBridge(proposalId, sentMessageSignature, transactionInfo)
  const parsedDataToBridge = decodedCalldata.at(1)
  return extractTransactionsFromBridgedData(parsedDataToBridge)
}

export async function getDecodedBytesForScroll(proposalId: number, transactionInfo: ExecuteTransactionInfo): Promise<ExecuteTransactionsInfo> {
  const sentMessageSignature = 'sendMessage(address,uint256,bytes,uint256)'
  const decodedCalldata = await getDecodedCallDataSentToBridge(proposalId, sentMessageSignature, transactionInfo)
  const parsedDataToBridge = decodedCalldata.at(2)
  return extractTransactionsFromBridgedData(parsedDataToBridge)
}

function extractTransactionsFromBridgedData(parsedDataToBridge: any) {
  const abiCoder = new AbiCoder()
  const decoded = abiCoder.decode(['address[]', 'uint256[]', 'string[]', 'bytes[]'], parsedDataToBridge.toString())

  return {
    targets: (decoded.at(0) as string[]).map((target) => target.toLowerCase()),
    values: (decoded.at(1) as BigNumber[]).map((value) => value),
    signatures: (decoded.at(2) as string[]).map((signature) => signature),
    calldatas: (decoded.at(3) as string[]).map((calldata) => calldata),
  }
}

export async function getDecodedCallDataSentToBridge(proposalId: number, sentMessageSignature: string, transactionInfo: ExecuteTransactionInfo) {
  const { fun, decodedCalldata } = await getFunctionFragmentAndDecodedCalldata(proposalId, CometChains.mainnet, {
    target: transactionInfo.target,
    signature: transactionInfo.signature,
    calldata: transactionInfo.calldata,
    value: transactionInfo.value,
  })

  const functionSignature = getFunctionSignature(fun)
  if (functionSignature !== sentMessageSignature) {
    throw new Error(`Function signature is not ${sentMessageSignature}. It is ${functionSignature}`)
  }

  return decodedCalldata
}
