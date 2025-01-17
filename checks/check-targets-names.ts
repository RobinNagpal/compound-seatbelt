import fs from 'fs'
import { bullet, toAddressLink } from '../presentation/report'
import { BridgedCheckResult, ProposalCheck } from '../types'
import { CometChains } from './compound/compound-types'
import { capitalizeWord } from './compound/formatters/helper'

/**
 * Check all targets are present in the target registry
 */
export const checkTargetsNames: ProposalCheck = {
  name: 'Check all targets are present in the registry',
  async checkProposal(proposal, sim, deps) {
    const uniqueTargets = proposal.targets.filter((addr, i, targets) => targets.indexOf(addr) === i)
    const mainnetResults = await checkTargetRegistry(uniqueTargets, CometChains.mainnet)
    
    const bridgedSimulations = sim.bridgedSimulations || []
    const bridgedCheckResults: BridgedCheckResult[] = await Promise.all(
      bridgedSimulations.map(async (b) => {
        if (b.proposal) {
              const uniqueBridgeTargets = b.proposal.targets.filter((addr, i, targets) => targets.indexOf(addr) === i)
              const bridgeResults = await checkTargetRegistry(uniqueBridgeTargets, b.chain);
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
 * For a given simulation response, check target registry for contract existence and name
 */
async function checkTargetRegistry(
  addresses: string[],
  chain: CometChains
) {
  const info: string[] = [];
  const errors: string[] = [];

  // Fetch the registry data for the specified chain once
  const registryData = getTargetRegistryData(chain);
  if (!registryData) {
    console.error(`Failed to fetch registry data for chain: ${chain}`);
    return { info, warnings: [], errors: [`Registry data for ${chain} not found`] };
  }

  // Check each address against the registry data
  for (const addr of addresses) {
    const contractName = registryData[addr.toLowerCase()];
    const address = toAddressLink(addr, false, chain);

    if (contractName) {
      info.push(bullet(`${address}: ${contractName}`));
    } else {
      errors.push(bullet(`${address}: Contract not in the Target Registry`));
    }
  }

  return { info, warnings: [], errors };
}

/**
 * Fetch the registry data for a given chain from the target registry file.
 */
function getTargetRegistryData(chain: CometChains): Record<string, string> | null {
  const targetRegistryFilePath = `./checks/compound/lookup/targetRegistry.json`;

  // Read and parse the file
  const fileContent = fs.readFileSync(targetRegistryFilePath, 'utf-8');
  const registryData = JSON.parse(fileContent);

  // Check if the chain exists in the registry
  if (!registryData[chain]) {
    console.error(`Target registry not found for '${capitalizeWord(chain)}'.`);
    return null;
  }

  // Return the data for the specific chain
  return registryData[chain];
}
