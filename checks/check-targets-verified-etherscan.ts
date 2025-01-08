import { JsonRpcProvider } from '@ethersproject/providers'
import { bullet, toAddressLink } from '../presentation/report'
import { BridgedCheckResult, ProposalCheck, TenderlyContract } from '../types'
import { customProvider } from '../utils/clients/ethers'
import { CometChains } from './compound/compound-types'

/**
 * Check all targets with code are verified on Etherscan
 */
export const checkTargetsVerifiedEtherscan: ProposalCheck = {
  name: 'Check all targets are verified on Explorer',
  async checkProposal(proposal, sim, deps) {
    const uniqueTargets = proposal.targets.filter((addr, i, targets) => targets.indexOf(addr) === i)
    const mainnetResults = await checkVerificationStatuses(sim.contracts, uniqueTargets, deps.provider, CometChains.mainnet)
    
    const bridgedSimulations = sim.bridgedSimulations || []
    const bridgedCheckResults: BridgedCheckResult[] = await Promise.all(
      bridgedSimulations.map(async (b) => {
        if (b.sim && b.proposal) {
              const uniqueBridgeTargets = b.proposal.targets.filter((addr, i, targets) => targets.indexOf(addr) === i)
              const customChainProvider = customProvider(b.chain)
              const bridgedContracts: TenderlyContract[] = b.sim.simulation_results.flatMap((sr) => sr.contracts) || [];
              const bridgeResults = await checkVerificationStatuses(bridgedContracts, uniqueBridgeTargets, customChainProvider, b.chain);
              return { chain: b.chain, checkResults: { ...bridgeResults } };
          } else {
              return { chain: b.chain, checkResults: { info: [], warnings: [], errors: ['No bridge simulation/proposal to verify the targets'] } };
          }
      })
    );
    
    return { ...mainnetResults, bridgedCheckResults }
  },
}

/**
 * Check all touched contracts with code are verified on Etherscan
 */
export const checkTouchedContractsVerifiedEtherscan: ProposalCheck = {
  name: 'Check all touched contracts are verified on Explorer',
  async checkProposal(proposal, sim, deps) {
    const mainnetResults = await checkVerificationStatuses(sim.contracts, sim.transaction.addresses, deps.provider, CometChains.mainnet)
    
    const bridgedSimulations = sim.bridgedSimulations || []
    const bridgedCheckResults: BridgedCheckResult[] = []
    for (const b of bridgedSimulations) {
      if (b.sim) {
        const bridgedContracts: TenderlyContract[] = b.sim.simulation_results.flatMap((sr) => sr.contracts) || [];
        const customChainProvider = customProvider(b.chain);
        const createAddresses = b.sim.simulation_results[0].transaction.addresses
        const executeAddresses = b.sim.simulation_results[1].transaction.addresses
        const uniqueAddresses = Array.from(new Set([...createAddresses, ...executeAddresses]));
        
        const bridgeResults = await checkVerificationStatuses(
          bridgedContracts,
          uniqueAddresses,
          customChainProvider,
          b.chain
        );
        bridgedCheckResults.push({ chain: b.chain, checkResults: { ...bridgeResults } });
      } else {
        bridgedCheckResults.push({ chain: b.chain, checkResults: { info: [], warnings: [], errors: ['No bridge simulation to verify contracts'] } });
      }
    }
        
    return { ...mainnetResults, bridgedCheckResults }
  },
}

/**
 * For a given simulation response, check verification status of a set of addresses
 */
async function checkVerificationStatuses(
  simContracts: TenderlyContract[],
  addresses: string[],
  provider: JsonRpcProvider,
  chain: CometChains
) {
  const info: string[] = []
  for (const addr of addresses) {
    const status = await checkVerificationStatus(simContracts, addr, provider)
    const address = toAddressLink(addr, false, chain)
    if (status === 'eoa') info.push(bullet(`${address}: EOA (verification not applicable)`))
    else if (status === 'verified') info.push(bullet(`${address}: Contract (verified)`))
    else info.push(bullet(`${address}: Contract (not verified)`))
  }
  return { info, warnings: [], errors: [] }
}

/**
 * For a given address, check if it's an EOA, a verified contract, or an unverified contract
 */
async function checkVerificationStatus(
  simContracts: TenderlyContract[],
  addr: string,
  provider: JsonRpcProvider
): Promise<'verified' | 'eoa' | 'unverified'> {
  // If an address exists in the contracts array, it's verified on the Explorer
  const contract = simContracts.find((item) => item.address.toLowerCase() === addr.toLowerCase())
  if (contract) return 'verified'
  // Otherwise, check if there's code at the address. Addresses with code not in the contracts array are not verified
  const code = await provider.getCode(addr)
  return code === '0x' ? 'eoa' : 'unverified'
}
