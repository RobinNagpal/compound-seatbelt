import { providers } from 'ethers'
import { CometChains } from '../../checks/compound/compound-types'
import {
  RPC_URL_ARBITRUM,
  RPC_URL_BASE,
  RPC_URL_MAINNET,
  RPC_URL_OPTIMISM,
  RPC_URL_POLYGON,
  RPC_URL_SCROLL,
} from '../constants'

export const provider = new providers.JsonRpcProvider(RPC_URL_MAINNET)

export function customProvider(chain: CometChains) {
  switch (chain.toString()) {
    case CometChains.mainnet:
      return new providers.JsonRpcProvider(RPC_URL_MAINNET)
    case CometChains.polygon:
      return new providers.JsonRpcProvider(RPC_URL_POLYGON)
    case CometChains.arbitrum:
      return new providers.JsonRpcProvider(RPC_URL_ARBITRUM)
    case CometChains.base:
      return new providers.JsonRpcProvider(RPC_URL_BASE)
    case CometChains.scroll:
      return new providers.JsonRpcProvider(RPC_URL_SCROLL)
    case CometChains.optimism:
      console.log('RPC_URL_OPTIMISM', RPC_URL_OPTIMISM)
      return new providers.JsonRpcProvider(RPC_URL_OPTIMISM)
    default:
      throw new Error('Unknown chain: ' + chain)
  }
}
