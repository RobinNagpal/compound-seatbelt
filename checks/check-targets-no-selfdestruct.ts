import { JsonRpcProvider } from '@ethersproject/providers'
import { bullet, toAddressLink } from '../presentation/report'
import { BridgedCheckResult, ProposalCheck } from '../types'
import { customProvider } from '../utils/clients/ethers'
import { ChainAddresses } from './compound/l2-utils'
import { CometChains } from './compound/compound-types'

/**
 * Check all targets with code if they contain selfdestruct.
 */
export const checkTargetsNoSelfdestruct: ProposalCheck = {
  name: 'Check all targets do not contain selfdestruct',
  async checkProposal(proposal, sim, deps) {
    const uniqueTargets = proposal.targets.filter((addr, i, targets) => targets.indexOf(addr) === i)
    const mainnetResults = await checkNoSelfdestructs(
      [deps.governor.address, deps.timelock.address],
      uniqueTargets,
      deps.provider,
      CometChains.mainnet
    )
    
    const bridgedSimulations = sim.bridgedSimulations || []
    const bridgedCheckResults: BridgedCheckResult[] = []
    for (const b of bridgedSimulations) {
      if (b.proposal) {
        const uniqueBridgeTargets = b.proposal.targets.filter((addr, i, targets) => targets.indexOf(addr) === i);
        const customChainProvider = customProvider(b.chain);
        const bridgeResults = await checkNoSelfdestructs(
          [ChainAddresses.L2BridgeReceiver[b.chain], ChainAddresses.L2Timelock[b.chain]],
          uniqueBridgeTargets,
          customChainProvider,
          b.chain
        );
        bridgedCheckResults.push({ chain: b.chain, checkResults: { ...bridgeResults } });
      } else {
        bridgedCheckResults.push({ chain: b.chain, checkResults: { info: [], warnings: [], errors: ['No proposal to check selfdestruct'] } });
      }
    }
    
    return { ...mainnetResults, bridgedCheckResults }
  },
}

/**
 * Check all touched contracts with code if they contain selfdestruct.
 */
export const checkTouchedContractsNoSelfdestruct: ProposalCheck = {
  name: 'Check all touched contracts do not contain selfdestruct',
  async checkProposal(proposal, sim, deps) {
    const mainnetResults = await checkNoSelfdestructs(
      [deps.governor.address, deps.timelock.address],
      sim.transaction.addresses,
      deps.provider,
      CometChains.mainnet
    )

    const bridgedSimulations = sim.bridgedSimulations || []
    const bridgedCheckResults: BridgedCheckResult[] = []
    for (const b of bridgedSimulations) {
      if (b.sim) {
        const customChainProvider = customProvider(b.chain);
        const createAddresses = b.sim.simulation_results[0].transaction.addresses
        const executeAddresses = b.sim.simulation_results[1].transaction.addresses
        const uniqueAddresses = Array.from(new Set([...createAddresses, ...executeAddresses]));
        const bridgeResults = await checkNoSelfdestructs(
          [ChainAddresses.L2BridgeReceiver[b.chain], ChainAddresses.L2Timelock[b.chain]],
          uniqueAddresses,
          customChainProvider,
          b.chain
        );
        bridgedCheckResults.push({ chain: b.chain, checkResults: { ...bridgeResults } });
      } else {
        bridgedCheckResults.push({ chain: b.chain, checkResults: { info: [], warnings: [], errors: ['No bridge simulation to check selfdestruct'] } });
      }
    }
    
    return { ...mainnetResults, bridgedCheckResults }
  },
}

/**
 * For a given simulation response, check if a set of addresses contain selfdestruct.
 */
async function checkNoSelfdestructs(
  trustedAddrs: string[],
  addresses: string[],
  provider: JsonRpcProvider,
  chain: CometChains
): Promise<{ info: string[]; warnings: string[]; errors: string[] }> {
  const info: string[] = []
  const warnings: string[] = []
  const errors: string[] = []
  for (const addr of addresses) {
    const status = await checkNoSelfdestruct(trustedAddrs, addr, provider)
    const address = toAddressLink(addr, false, chain)
    if (status === 'eoa') info.push(bullet(`${address}: EOA`))
    else if (status === 'empty') warnings.push(bullet(`${address}: EOA (may have code later)`))
    else if (status === 'safe') info.push(bullet(`${address}: Contract (looks safe)`))
    else if (status === 'delegatecall') warnings.push(bullet(`${address}: Contract (with DELEGATECALL)`))
    else if (status === 'trusted') info.push(bullet(`${address}: Trusted contract (not checked)`))
    else errors.push(bullet(`${address}: Contract (with SELFDESTRUCT)`))
  }
  return { info, warnings, errors }
}

const STOP = 0x00
const JUMPDEST = 0x5b
const PUSH1 = 0x60
const PUSH32 = 0x7f
const RETURN = 0xf3
const REVERT = 0xfd
const INVALID = 0xfe
const SELFDESTRUCT = 0xff
const DELEGATECALL = 0xf4

const isHalting = (opcode: number): boolean => [STOP, RETURN, REVERT, INVALID, SELFDESTRUCT].includes(opcode)
const isPUSH = (opcode: number): boolean => opcode >= PUSH1 && opcode <= PUSH32

/**
 * For a given address, check if it's an EOA, a safe contract, or a contract contain selfdestruct.
 */
async function checkNoSelfdestruct(
  trustedAddrs: string[],
  addr: string,
  provider: JsonRpcProvider
): Promise<'safe' | 'eoa' | 'empty' | 'selfdestruct' | 'delegatecall' | 'trusted'> {
  if (trustedAddrs.map(addr => addr.toLowerCase()).includes(addr.toLowerCase())) return 'trusted'

  const [code, nonce] = await Promise.all([provider.getCode(addr), provider.getTransactionCount(addr)])

  // If there is no code and nonce is > 0 then it's an EOA.
  // If nonce is 0 it is an empty account that might have code later.
  // A contract might have nonce > 0, but then it will have code.
  // If it had code, but was selfdestructed, the nonce should be reset to 0.
  if (code === '0x') return nonce > 0 ? 'eoa' : 'empty'

  // Detection logic from https://github.com/MrLuit/selfdestruct-detect
  const bytecode = Buffer.from(code.substring(2), 'hex')
  let halted = false
  let delegatecall = false
  for (let index = 0; index < bytecode.length; index++) {
    const opcode = bytecode[index]
    if (opcode === SELFDESTRUCT && !halted) {
      return 'selfdestruct'
    } else if (opcode === DELEGATECALL && !halted) {
      delegatecall = true
    } else if (opcode === JUMPDEST) {
      halted = false
    } else if (isHalting(opcode)) {
      halted = true
    } else if (isPUSH(opcode)) {
      index += opcode - PUSH1 + 0x01
    }
  }

  return delegatecall ? 'delegatecall' : 'safe'
}
