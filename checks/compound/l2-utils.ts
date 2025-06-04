import { StateObject } from '@/types'
import { AbiCoder, defaultAbiCoder, Interface } from '@ethersproject/abi'
import { BigNumber } from '@ethersproject/bignumber'
import { getFunctionFragmentAndDecodedCalldata, getFunctionSignature } from './abi-utils'
import { CometChains, ExecuteTransactionInfo, ExecuteTransactionsInfo, L2Chain } from './compound-types'
import {
  ARBITRUMSCAN_API_KEY,
  BASESCAN_API_KEY,
  ETHERSCAN_API_KEY,
  MANTLESCAN_API_KEY,
  OPTIMISMIC_ETHERSCAN_API_KEY,
  POLYGONSCAN_API_KEY,
  SCROLLSCAN_API_KEY,
  UNISCAN_API_KEY,
} from './../../utils/constants'

export const l2Bridges: { [address: string]: L2Chain } = {
  '0x4dbd4fc535ac27206064b68ffcf827b0a60bab3f': CometChains.arbitrum,
  '0xfe5e5d361b2ad62c541bab87c45a0b9b018389a2': CometChains.polygon,
  '0x866e82a600a1414e583f7f13623f1ac5d58b0afa': CometChains.base,
  '0x6774bcbd5cecef1336b5300fb5186a12ddd8b367': CometChains.scroll,
  '0x25ace71c97b33cc4729cf772ae268934f7ab5fa1': CometChains.optimism,
  '0x676a795fe6e43c17c668de16730c3f690feb7120': CometChains.mantle,
  '0x9a3d64e386c18cb1d6d5179a9596a4b5736e98a6': CometChains.unichain,
}

// Define network ID mapping for supported bridged chains
export const l2ChainIdMap: Record<L2Chain, string> = {
  [CometChains.arbitrum]: '42161',
  [CometChains.optimism]: '10',
  [CometChains.polygon]: '137',
  [CometChains.base]: '8453',
  [CometChains.scroll]: '534352',
  [CometChains.mantle]: '5000',
  [CometChains.unichain]: '130',
}

export const l2ChainSenderMap: Record<L2Chain, string> = {
  [CometChains.arbitrum]: '0x7ea13f6003cca6255d85cca4d3b5e5146dc34a36', //L2 Alias of Governor Timelock
  [CometChains.optimism]: '0x4200000000000000000000000000000000000007', //L2CrossDomainMessenger
  [CometChains.polygon]: '0x8397259c983751DAf40400790063935a11afa28a', //fxChild
  [CometChains.base]: '0x4200000000000000000000000000000000000007', //L2CrossDomainMessenger
  [CometChains.unichain]: '0x4200000000000000000000000000000000000007', //L2CrossDomainMessenger
  [CometChains.scroll]: '0x4dbd4fc535ac27206064b68ffcf827b0a60bab3f', //L2ScrollMessenger
  [CometChains.mantle]: '0x4200000000000000000000000000000000000007', //L2CrossDomainMessenger
}

export const MarketUpdateProposerMap: Record<CometChains, string> = {
  [CometChains.mainnet]: '',
  [CometChains.arbitrum]: '',
  [CometChains.optimism]: '0xB6Ef3AC71E9baCF1F4b9426C149d855Bfc4415F9',
  [CometChains.polygon]: '',
  [CometChains.base]: '',
  [CometChains.unichain]: '',
  [CometChains.scroll]: '',
  [CometChains.mantle]: '0xea45D76425be2a1de4EC5FE24fCe992e3e8593FD',
}

export interface apiKeyFlagConfig {
  flag: string
  key: string
  prefix: string
}

export const apiKeyFlagMap: Record<CometChains, apiKeyFlagConfig> = {
  [CometChains.mainnet]: { flag: '--etherscan-apikey', key: ETHERSCAN_API_KEY, prefix: 'mainet' },
  [CometChains.arbitrum]: { flag: '--arbiscan-apikey', key: ARBITRUMSCAN_API_KEY, prefix: 'arbi' },
  [CometChains.optimism]: { flag: '--optim-apikey', key: OPTIMISMIC_ETHERSCAN_API_KEY, prefix: 'optim' },
  [CometChains.polygon]: { flag: '--polygonscan-apikey', key: POLYGONSCAN_API_KEY, prefix: 'poly' },
  // TODO - Add correct Base Flag after slither supports Base
  [CometChains.base]: { flag: '--base-apikey', key: BASESCAN_API_KEY, prefix: 'base' },
  // TODO - Add correct Scroll Flag after crytic-compile/slither supports Scroll
  [CometChains.scroll]: { flag: '--scroll-apikey', key: SCROLLSCAN_API_KEY, prefix: 'scroll' },
  // TODO - Add correct Mantle Flag after crytic-compile/slither supports Mantle
  [CometChains.mantle]: { flag: '--mantle-apikey', key: MANTLESCAN_API_KEY, prefix: 'mantle' },
  [CometChains.unichain]: { flag: '--uni-apikey', key: UNISCAN_API_KEY, prefix: 'uni' },
}

export function getBridgeReceiverOverrides(chain: CometChains): Record<string, StateObject> | undefined {
  if (chain === CometChains.optimism || chain === CometChains.base || chain === CometChains.mantle || chain === CometChains.unichain) {
    return {
      // Setting CrossDomainMessenger.xDomainMessageSender to the Main Governor Timelock address
      '0x4200000000000000000000000000000000000007': {
        storage: {
          '0x00000000000000000000000000000000000000000000000000000000000000cc': '0x0000000000000000000000006d903f6003cca6255d85cca4d3b5e5146dc33925',
        },
      },
    }
  }
}

export function getBridgeReceiverInput(chain: CometChains, l2TransactionsInfo: ExecuteTransactionsInfo): string {
  const { targets, values, signatures, calldatas } = l2TransactionsInfo
  if (
    chain === CometChains.optimism ||
    chain === CometChains.unichain ||
    chain === CometChains.base ||
    chain === CometChains.scroll ||
    chain === CometChains.arbitrum ||
    chain === CometChains.mantle
  ) {
    return defaultAbiCoder.encode(['address[]', 'uint256[]', 'string[]', 'bytes[]'], [targets, values, signatures, calldatas])
  } else if (chain === CometChains.polygon) {
    const iface = new Interface(['function processMessageFromRoot(uint256 stateId, address rootMessageSender, bytes data) external'])
    const data = defaultAbiCoder.encode(['address[]', 'uint256[]', 'string[]', 'bytes[]'], [targets, values, signatures, calldatas])
    return iface.encodeFunctionData('processMessageFromRoot', [1, AllChainAddresses.MAINNET_GOVERNOR_TIMELOCK, data])
  }
  throw new Error(`${chain} chain is not supported`)
}

export const AllChainAddresses = {
  MAINNET_GOVERNOR_TIMELOCK: '0x6d903f6003cca6255D85CcA4D3B5E5146dC33925', // See - https://etherscan.io/address/0x6d903f6003cca6255D85CcA4D3B5E5146dC33925
  MAINNET_CONFIGURATOR_PROXY: '0x316f9708bB98af7dA9c68C1C3b5e79039cD336E3', // See - https://etherscan.io/address/0x316f9708bB98af7dA9c68C1C3b5e79039cD336E3
  MAINNET_COMET_PROXY_ADMIN: '0x1EC63B5883C3481134FD50D5DAebc83Ecd2E8779', // See - https://etherscan.io/address/0x1EC63B5883C3481134FD50D5DAebc83Ecd2E8779

  MAINNET_MARKET_ADMIN: '0xA1C7b6d8b4DeD5ee46330C865cC8aeCfB13c8b65', // See - https://etherscan.io/address/0xA1C7b6d8b4DeD5ee46330C865cC8aeCfB13c8b65
  MAINNET_MARKET_UPDATE_PAUSE_GUARDIAN: '0xbbf3f1421D886E9b2c5D716B5192aC998af2012c', // See - pauseGuardian in https://etherscan.io/address/0xc3d688B66703497DAA19211EEdff47f25384cdc3#readProxyContract
  MAINNET_MARKET_UPDATE_PROPOSAL_GUARDIAN: '0xbbf3f1421D886E9b2c5D716B5192aC998af2012c', // See - https://etherscan.io/address/0xc3d688B66703497DAA19211EEdff47f25384cdc3#readProxyContract

  POLYGON_LOCAL_TIMELOCK: '0xCC3E7c85Bb0EE4f09380e041fee95a0caeDD4a02', // See - https://polygonscan.com/address/0xCC3E7c85Bb0EE4f09380e041fee95a0caeDD4a02
  POLYGON_CONFIGURATOR_PROXY: '0x83E0F742cAcBE66349E3701B171eE2487a26e738', // See - https://polygonscan.com/address/0x83E0F742cAcBE66349E3701B171eE2487a26e738
  POLYGON_COMET_PROXY_ADMIN: '0xd712ACe4ca490D4F3E92992Ecf3DE12251b975F9', // See - https://polygonscan.com/address/0xd712ACe4ca490D4F3E92992Ecf3DE12251b975F9
  POLYGON_BRIDGE_RECEIVER: '0x18281dfC4d00905DA1aaA6731414EABa843c468A', // See - https://polygonscan.com/address/0x18281dfC4d00905DA1aaA6731414EABa843c468A

  POLYGON_MARKET_ADMIN: '0x7e14050080306cd36b47DE61ce604b3a1EC70c4e', // See - https://polygonscan.com/address/0x7e14050080306cd36b47DE61ce604b3a1EC70c4e
  POLYGON_MARKET_UPDATE_PAUSE_GUARDIAN: '0x8Ab717CAC3CbC4934E63825B88442F5810aAF6e5', // See - pauseGuardian in https://polygonscan.com/address/0x8Ab717CAC3CbC4934E63825B88442F5810aAF6e5#readProxyContract
  POLYGON_MARKET_UPDATE_PROPOSAL_GUARDIAN: '0x8Ab717CAC3CbC4934E63825B88442F5810aAF6e5', // See - https://polygonscan.com/address/0x8Ab717CAC3CbC4934E63825B88442F5810aAF6e5#readProxyContract

  ARBITRUM_LOCAL_TIMELOCK: '0x3fB4d38ea7EC20D91917c09591490Eeda38Cf88A', // See - https://arbiscan.io/address/0x3fB4d38ea7EC20D91917c09591490Eeda38Cf88A
  ARBITRUM_CONFIGURATOR_PROXY: '0xb21b06D71c75973babdE35b49fFDAc3F82Ad3775', // See - https://arbiscan.io/address/0xb21b06D71c75973babdE35b49fFDAc3F82Ad3775
  ARBITRUM_COMET_PROXY_ADMIN: '0xD10b40fF1D92e2267D099Da3509253D9Da4D715e', // See - https://arbiscan.io/address/0xD10b40fF1D92e2267D099Da3509253D9Da4D715e
  ARBITRUM_BRIDGE_RECEIVER: '0x42480C37B249e33aABaf4c22B20235656bd38068', // See - https://arbiscan.io/address/0x42480C37B249e33aABaf4c22B20235656bd38068

  ARBITRUM_MARKET_ADMIN: '0x7e14050080306cd36b47DE61ce604b3a1EC70c4e', // See - https://arbiscan.io/address/0x7e14050080306cd36b47DE61ce604b3a1EC70c4e
  ARBITRUM_MARKET_UPDATE_PAUSE_GUARDIAN: '0x78E6317DD6D43DdbDa00Dce32C2CbaFc99361a9d', // See - https://arbiscan.io/address/0xd98Be00b5D27fc98112BdE293e487f8D4cA57d07#readProxyContract
  ARBITRUM_MARKET_UPDATE_PROPOSAL_GUARDIAN: '0x78E6317DD6D43DdbDa00Dce32C2CbaFc99361a9d', // See - https://arbiscan.io/address/0xd98Be00b5D27fc98112BdE293e487f8D4cA57d07#readProxyContract

  BASE_LOCAL_TIMELOCK: '0xCC3E7c85Bb0EE4f09380e041fee95a0caeDD4a02', // See - https://basescan.org/address/0xCC3E7c85Bb0EE4f09380e041fee95a0caeDD4a02
  BASE_CONFIGURATOR_PROXY: '0x45939657d1CA34A8FA39A924B71D28Fe8431e581', // See - https://basescan.org/address/0x45939657d1CA34A8FA39A924B71D28Fe8431e581
  BASE_COMET_PROXY_ADMIN: '0xbdE8F31D2DdDA895264e27DD990faB3DC87b372d', // See - https://basescan.org/address/0xbdE8F31D2DdDA895264e27DD990faB3DC87b372d
  BASE_BRIDGE_RECEIVER: '0x18281dfC4d00905DA1aaA6731414EABa843c468A', // See - https://basescan.org/address/0x18281dfC4d00905DA1aaA6731414EABa843c468A

  UNICHAIN_LOCAL_TIMELOCK: '0x2F4eAF29dfeeF4654bD091F7112926E108eF4Ed0', // See - https://basescan.org/address/0xCC3E7c85Bb0EE4f09380e041fee95a0caeDD4a02
  // BASE_CONFIGURATOR_PROXY: '0x45939657d1CA34A8FA39A924B71D28Fe8431e581', // See - https://basescan.org/address/0x45939657d1CA34A8FA39A924B71D28Fe8431e581
  UNICHAIN_COMET_PROXY_ADMIN: '0xaeB318360f27748Acb200CE616E389A6C9409a07', // See - https://basescan.org/address/0xbdE8F31D2DdDA895264e27DD990faB3DC87b372d
  UNICHAIN_BRIDGE_RECEIVER: '0x4b5DeE60531a72C1264319Ec6A22678a4D0C8118', // See - https://basescan.org/address/0x18281dfC4d00905DA1aaA6731414EABa843c468A

  BASE_MARKET_ADMIN: '0x7e14050080306cd36b47DE61ce604b3a1EC70c4e',
  BASE_MARKET_UPDATE_PAUSE_GUARDIAN: '0x3cb4653F3B45F448D9100b118B75a1503281d2ee', // See - https://basescan.org/address/0x46e6b214b524310239732D51387075E0e70970bf#readProxyContract
  BASE_MARKET_UPDATE_PROPOSAL_GUARDIAN: '0x3cb4653F3B45F448D9100b118B75a1503281d2ee', // See - https://basescan.org/address/0x46e6b214b524310239732D51387075E0e70970bf#readProxyContract

  SCROLL_LOCAL_TIMELOCK: '0xF6013e80E9e6AC211Cc031ad1CE98B3Aa20b73E4', // See - https://scrollscan.com/address/0xF6013e80E9e6AC211Cc031ad1CE98B3Aa20b73E4
  SCROLL_CONFIGURATOR_PROXY: '0xECAB0bEEa3e5DEa0c35d3E69468EAC20098032D7', // See - https://scrollscan.com/address/0xECAB0bEEa3e5DEa0c35d3E69468EAC20098032D7
  SCROLL_COMET_PROXY_ADMIN: '0x87A27b91f4130a25E9634d23A5B8E05e342bac50', // See - https://scrollscan.com/address/0x87A27b91f4130a25E9634d23A5B8E05e342bac50
  SCROLL_BRIDGE_RECEIVER: '0xC6bf5A64896D679Cf89843DbeC6c0f5d3C9b610D', // See - https://scrollscan.com/address/0xC6bf5A64896D679Cf89843DbeC6c0f5d3C9b610D

  SCROLL_MARKET_ADMIN: '0x7e14050080306cd36b47DE61ce604b3a1EC70c4e', // See - https://scrollscan.com/address/0x7e14050080306cd36b47DE61ce604b3a1EC70c4e
  SCROLL_MARKET_UPDATE_PAUSE_GUARDIAN: '0x0747a435b8a60070A7a111D015046d765098e4cc', // See - https://scrollscan.com/address/0xB2f97c1Bd3bf02f5e74d13f02E3e26F93D77CE44#readProxyContract
  SCROLL_MARKET_UPDATE_PROPOSAL_GUARDIAN: '0x0747a435b8a60070A7a111D015046d765098e4cc', // See - https://scrollscan.com/address/0xB2f97c1Bd3bf02f5e74d13f02E3e26F93D77CE44#readProxyContract

  OPTIMISM_LOCAL_TIMELOCK: '0xd98Be00b5D27fc98112BdE293e487f8D4cA57d07', // See - https://optimistic.etherscan.io/address/0xd98Be00b5D27fc98112BdE293e487f8D4cA57d07
  OPTIMISM_CONFIGURATOR_PROXY: '0x84E93EC6170ED630f5ebD89A1AAE72d4F63f2713', // See - https://optimistic.etherscan.io/address/0x84E93EC6170ED630f5ebD89A1AAE72d4F63f2713
  OPTIMISM_COMET_PROXY_ADMIN: '0x24D86Da09C4Dd64e50dB7501b0f695d030f397aF', // See - https://optimistic.etherscan.io/address/0x24D86Da09C4Dd64e50dB7501b0f695d030f397aF
  OPTIMISM_BRIDGE_RECEIVER: '0xC3a73A70d1577CD5B02da0bA91C0Afc8fA434DAF', // See - https://optimistic.etherscan.io/address/0x18281dfC4d00905DA1aaA6731414EABa843c468A

  OPTIMISM_MARKET_ADMIN: '0x7e14050080306cd36b47DE61ce604b3a1EC70c4e', // See - https://optimistic.etherscan.io/address/0x7e14050080306cd36b47DE61ce604b3a1EC70c4e
  OPTIMISM_MARKET_UPDATE_PAUSE_GUARDIAN: '0x3fFd6c073a4ba24a113B18C8F373569640916A45', // See - https://optimistic.etherscan.io/address/0xE36A30D249f7761327fd973001A32010b521b6Fd#readProxyContract
  OPTIMISM_MARKET_UPDATE_PROPOSAL_GUARDIAN: '0x3fFd6c073a4ba24a113B18C8F373569640916A45', // See - https://optimistic.etherscan.io/address/0xE36A30D249f7761327fd973001A32010b521b6Fd#readProxyContract

  MANTLE_LOCAL_TIMELOCK: '0x16C7B5C1b10489F4B111af11de2Bd607c9728107', // See - https://mantlescan.xyz/address/0x6d903f6003cca6255D85CcA4D3B5E5146dC33925
  MANTLE_CONFIGURATOR_PROXY: '0xb77Cd4cD000957283D8BAf53cD782ECf029cF7DB', // See - https://mantlescan.xyz/address/0x4c8e3b3c4f3f1f6f4f1f4f4f4f4f4f4f4f4f4f4
  MANTLE_COMET_PROXY_ADMIN: '0xe268B436E75648aa0639e2088fa803feA517a0c7', // See - https://mantlescan.xyz/address/0x4c8e3b3c4f3f1f6f4f1f4f4f4f4f4f4f4f4f4f4
  MANTLE_BRIDGE_RECEIVER: '0xc91EcA15747E73d6dd7f616C49dAFF37b9F1B604', // See - https://mantlescan.xyz/address/0x4c8e3b3c4f3f1f6f4f1f4f4f4f4f4f4f4f4f4f4

  MANTLE_MARKET_ADMIN: '0x7e14050080306cd36b47DE61ce604b3a1EC70c4e', // See - https://mantlescan.xyz/address/0x7e14050080306cd36b47DE61ce604b3a1EC70c4e
  MANTLE_MARKET_UPDATE_PAUSE_GUARDIAN: '0x3fFd6c073a4ba24a113B18C8F373569640916A45', // See - https://mantlescan.xyz/address/0xE36A30D249f7761327fd973001A32010b521b6Fd#readProxyContract
  MANTLE_MARKET_UPDATE_PROPOSAL_GUARDIAN: '0x3fFd6c073a4ba24a113B18C8F373569640916A45', // See - https://mantlescan.xyz/address/0xE36A30D249f7761327fd973001A32010b521b6Fd#readProxyContract
}

export const ChainAddresses = {
  L2Timelock: {
    [CometChains.arbitrum]: AllChainAddresses.ARBITRUM_LOCAL_TIMELOCK,
    [CometChains.optimism]: AllChainAddresses.OPTIMISM_LOCAL_TIMELOCK,
    [CometChains.polygon]: AllChainAddresses.POLYGON_LOCAL_TIMELOCK,
    [CometChains.base]: AllChainAddresses.BASE_LOCAL_TIMELOCK,
    [CometChains.scroll]: AllChainAddresses.SCROLL_LOCAL_TIMELOCK,
    [CometChains.mantle]: AllChainAddresses.MANTLE_LOCAL_TIMELOCK,
    [CometChains.unichain]: AllChainAddresses.UNICHAIN_LOCAL_TIMELOCK,
  },
  L2BridgeReceiver: {
    [CometChains.arbitrum]: AllChainAddresses.ARBITRUM_BRIDGE_RECEIVER,
    [CometChains.optimism]: AllChainAddresses.OPTIMISM_BRIDGE_RECEIVER,
    [CometChains.polygon]: AllChainAddresses.POLYGON_BRIDGE_RECEIVER,
    [CometChains.base]: AllChainAddresses.BASE_BRIDGE_RECEIVER,
    [CometChains.scroll]: AllChainAddresses.SCROLL_BRIDGE_RECEIVER,
    [CometChains.mantle]: AllChainAddresses.MANTLE_BRIDGE_RECEIVER,
    [CometChains.unichain]: AllChainAddresses.UNICHAIN_BRIDGE_RECEIVER,
  },
}

export async function getDecodedBytesForChain(
  sourceChain: CometChains,
  chain: CometChains,
  proposalId: number,
  transactionInfo: ExecuteTransactionInfo,
): Promise<ExecuteTransactionsInfo> {
  switch (chain) {
    case CometChains.arbitrum:
      return getDecodedBytesForArbitrum(sourceChain, proposalId, transactionInfo)
    case CometChains.base:
      return getDecodedBytesForBase(sourceChain, proposalId, transactionInfo)
    case CometChains.polygon:
      return getDecodedBytesForPolygon(sourceChain, proposalId, transactionInfo)
    case CometChains.scroll:
      return getDecodedBytesForScroll(sourceChain, proposalId, transactionInfo)
    case CometChains.optimism:
      return getDecodedBytesForOptimism(sourceChain, proposalId, transactionInfo)
    case CometChains.unichain:
      return getDecodedBytesForUnichain(sourceChain, proposalId, transactionInfo)
    case CometChains.mantle:
      return getDecodedBytesForMantle(sourceChain, proposalId, transactionInfo)
    default:
      throw new Error(`Chain ${chain} is not supported`)
  }
}

export async function getDecodedBytesForArbitrum(
  sourceChain: CometChains,
  proposalId: number,
  transactionInfo: ExecuteTransactionInfo,
): Promise<ExecuteTransactionsInfo> {
  const sentMessageSignature = 'createRetryableTicket(address,uint256,uint256,address,address,uint256,uint256,bytes)'
  const decodedCalldata = await getDecodedCallDataSentToBridge(sourceChain, proposalId, sentMessageSignature, transactionInfo)
  const parsedDataToBridge = decodedCalldata.at(7)
  return extractTransactionsFromBridgedData(parsedDataToBridge)
}

export async function getDecodedBytesForOptimism(
  sourceChain: CometChains,
  proposalId: number,
  transactionInfo: ExecuteTransactionInfo,
): Promise<ExecuteTransactionsInfo> {
  const sentMessageSignature = 'sendMessage(address,bytes,uint32)'
  const decodedCalldata = await getDecodedCallDataSentToBridge(sourceChain, proposalId, sentMessageSignature, transactionInfo)
  const parsedDataToBridge = decodedCalldata.at(1)
  return extractTransactionsFromBridgedData(parsedDataToBridge)
}

export async function getDecodedBytesForMantle(
  sourceChain: CometChains,
  proposalId: number,
  transactionInfo: ExecuteTransactionInfo,
): Promise<ExecuteTransactionsInfo> {
  const sentMessageSignature = 'sendMessage(address,bytes,uint32)'
  const decodedCalldata = await getDecodedCallDataSentToBridge(sourceChain, proposalId, sentMessageSignature, transactionInfo)
  const parsedDataToBridge = decodedCalldata.at(1)
  return extractTransactionsFromBridgedData(parsedDataToBridge)
}

export async function getDecodedBytesForBase(
  sourceChain: CometChains,
  proposalId: number,
  transactionInfo: ExecuteTransactionInfo,
): Promise<ExecuteTransactionsInfo> {
  const sentMessageSignature = 'sendMessage(address,bytes,uint32)'
  const decodedCalldata = await getDecodedCallDataSentToBridge(sourceChain, proposalId, sentMessageSignature, transactionInfo)
  const parsedDataToBridge = decodedCalldata.at(1)
  return extractTransactionsFromBridgedData(parsedDataToBridge)
}

export async function getDecodedBytesForUnichain(
  sourceChain: CometChains,
  proposalId: number,
  transactionInfo: ExecuteTransactionInfo,
): Promise<ExecuteTransactionsInfo> {
  const sentMessageSignature = 'sendMessage(address,bytes,uint32)'
  const decodedCalldata = await getDecodedCallDataSentToBridge(sourceChain, proposalId, sentMessageSignature, transactionInfo)
  const parsedDataToBridge = decodedCalldata.at(1)
  return extractTransactionsFromBridgedData(parsedDataToBridge)
}

export async function getDecodedBytesForPolygon(
  sourceChain: CometChains,
  proposalId: number,
  transactionInfo: ExecuteTransactionInfo,
): Promise<ExecuteTransactionsInfo> {
  const sentMessageSignature = 'sendMessageToChild(address,bytes)'
  const decodedCalldata = await getDecodedCallDataSentToBridge(sourceChain, proposalId, sentMessageSignature, transactionInfo)
  const parsedDataToBridge = decodedCalldata.at(1)
  return extractTransactionsFromBridgedData(parsedDataToBridge)
}

export async function getDecodedBytesForScroll(
  sourceChain: CometChains,
  proposalId: number,
  transactionInfo: ExecuteTransactionInfo,
): Promise<ExecuteTransactionsInfo> {
  const sentMessageSignature = 'sendMessage(address,uint256,bytes,uint256)'
  const decodedCalldata = await getDecodedCallDataSentToBridge(sourceChain, proposalId, sentMessageSignature, transactionInfo)
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

export async function getDecodedCallDataSentToBridge(
  sourceChain: CometChains,
  proposalId: number,
  sentMessageSignature: string,
  transactionInfo: ExecuteTransactionInfo,
) {
  const { fun, decodedCalldata } = await getFunctionFragmentAndDecodedCalldata(proposalId, sourceChain, {
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
