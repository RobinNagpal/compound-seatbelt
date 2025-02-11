import dotenv from 'dotenv'
dotenv.config()

import { analyzeProposal } from './checks/compound/check-compound-proposal-details'
import { listFilesInFolder, uploadFileToS3 } from './checks/compound/s3-utils'
import { BigNumber, Contract } from 'ethers'
import { DAO_NAME, GOVERNOR_ADDRESS } from './utils/constants'
import { customProvider } from './utils/clients/ethers'
import { simulate } from './utils/clients/market-update-tenderly'
import { AllCheckResults, ConfigWithoutGovernorType, MarketUpdateSimulationData, SimulationConfigBase } from './types'
import ALL_CHECKS from './checks'
import { generateAndSaveReports, pushCompoundChecksToDiscord, pushCompoundChecksToEmail } from './presentation/report'
import {
  formatProposalId,
  getProposer,
  getProposalIds,
  getTimelock,
  PROPOSAL_STATES
} from './utils/contracts/market-update-proposer'
import { getAddress } from '@ethersproject/address'
import { MarketUpdateProposerMap } from './checks/compound/l2-utils'
import { CometChains } from './checks/compound/compound-types'

async function main() {
  console.log('Starting main function with GOVERNOR_ADDRESS: ', GOVERNOR_ADDRESS)

  // --- Run simulations ---
  // Prepare array to store all simulation outputs
  const simOutputs: MarketUpdateSimulationData[] = []
  
  // If no SIM_NAME is provided, we get proposals to simulate from the chain
  // if (!GOVERNOR_ADDRESS) throw new Error('Must provider a GOVERNOR_ADDRESS')
  if (!DAO_NAME) throw new Error('Must provider a DAO_NAME')
    
  for (const [chain, PROPOSER_ADDRESS] of Object.entries(MarketUpdateProposerMap).filter(([_, address]) => address !== '')) {
      // TODO: Remove this check after Tenderly add support for Scroll
    if (chain === CometChains.scroll) {
      console.log('Tenderly does not support simulating transactions on Scroll')
      continue
    }
    const s3ReportsFolder = `${process.env.AWS_BUCKET_BASE_PATH}/${chain}` || `all-proposals/${chain}`
    const provider = customProvider(chain as CometChains);
        
    const latestBlock = await provider.getBlock('latest');
    console.log(`Chain: ${chain}, Address: ${PROPOSER_ADDRESS}, Latest Block: ${latestBlock.number}`);
      
    // Fetch all proposal IDs
    const allProposalIds = await getProposalIds(PROPOSER_ADDRESS, latestBlock.number, provider)
    const files = await listFilesInFolder(s3ReportsFolder)
    console.log('files', files)
    const proposalIdsArr =
      process.env.SELECTED_PROPOSALS?.split(',') || allProposalIds.filter((id) => id.toNumber() > 0)

    const proposalIds = proposalIdsArr.map((id) => BigNumber.from(id))

    const proposer: Contract = getProposer(PROPOSER_ADDRESS, provider)

    // If we aren't simulating all proposals, filter down to just the active ones. For now we
    // assume we're simulating all by default
    const states = await Promise.all(proposalIds.map((id) => proposer.state(id)))
    const simProposals: { id: BigNumber; simType: SimulationConfigBase['type'] }[] = proposalIds.map((id, i) => {
      // If state is `Executed` (state 3), we use the executed sim type and effectively just
      // simulate the real transaction. For all other states, we use the `proposed` type because
      // state overrides are required to simulate the transaction
      const state = String(states[i]) as keyof typeof PROPOSAL_STATES
      const isExecuted = PROPOSAL_STATES[state] === 'Executed'
      return { id, simType: isExecuted ? 'executed' : 'proposed' }
    })
    const simProposalsIds = simProposals.map((sim) => sim.id)

    // Simulate them
    // We intentionally do not run these in parallel to avoid hitting Tenderly API rate limits or flooding
    // them with requests if we e.g. simulate all proposals for a governor (instead of just active ones)
    const numProposals = simProposals.length
    console.log(
      `Simulating ${numProposals} ${DAO_NAME} proposals: IDs of ${simProposalsIds
        .map((id) => formatProposalId(id))
        .join(', ')}`,
    )

    for (const simProposal of simProposals) {
      if (simProposal.simType === 'new') throw new Error('Simulation type "new" is not supported in this branch')
      // Determine if this proposal is already `executed` or currently in-progress (`proposed`)
      const config: ConfigWithoutGovernorType = {
        type: simProposal.simType,
        daoName: DAO_NAME,
        governorAddress: getAddress(PROPOSER_ADDRESS),
        proposalId: simProposal.id,
      }

      const pdfExists = files.includes(`${s3ReportsFolder}/${simProposal.id.toString()}.pdf`)

      if (!process.env.SELECTED_PROPOSALS && pdfExists) {
        console.log(`Skipping simulation for proposal ${simProposal.id}  as PDF already exists in S3...`)
        continue
      }

      console.log(`  Simulating ${DAO_NAME} proposal ${simProposal.id}...`)
      const { sim, proposal, latestBlock } = await simulate(config, provider, chain as CometChains)
      simOutputs.push({ sim, proposal, latestBlock, config })
      console.log(`done`)
    }
  

  // --- Run proposal checks and save output ---
  // Generate the proposal data and dependencies needed by checks
  const proposalData = { governor: proposer, provider, timelock: await getTimelock(proposer.address, provider), chain: (chain as CometChains) }

  for (const simOutput of simOutputs) {
    console.log('Starting proposal checks and report generation...')
    // Run checks
    const { sim, proposal, latestBlock, config } = simOutput
    console.log(`  Running for proposal ID ${formatProposalId(proposal.id!)}...`)

    const checksToRun = Object.keys(ALL_CHECKS)
      .filter((key) => (process.env.ENABLED_CHECKS ? process.env.ENABLED_CHECKS.split(',').includes(key) : true))
      .filter((key) => {
        return String(process.env.SKIP_DEFAULT_CHECKS).toLowerCase() !== 'true'
      })
    console.log(`Running ${checksToRun.length} checks: ${checksToRun.join(', ')} for proposal ID ${proposal.id!}`)
    const checkResults: AllCheckResults = Object.fromEntries(
      await Promise.all(
        checksToRun.map(async (checkId) => [
          checkId,
          {
            name: ALL_CHECKS[checkId].name,
            result: await ALL_CHECKS[checkId].checkProposal(proposal, sim, proposalData),
          },
        ]),
      ),
    )

    const compProposalAnalysis =
      process.env.DISABLE_COMPOUND_CHECKS === 'true'
        ? { mainnetActionAnalysis: [], chainedProposalAnalysis: [] }
        : await analyzeProposal(proposal, sim, proposalData)
        
    // Generate markdown report.
    const [startBlock, endBlock] = await Promise.all([
      proposal.startBlock && proposal.startBlock.toNumber() <= latestBlock.number
        ? provider.getBlock(proposal.startBlock.toNumber())
        : null,
      proposal.endBlock && proposal.endBlock.toNumber() <= latestBlock.number
        ? provider.getBlock(proposal.endBlock.toNumber())
        : null,
    ]);
    
    // Save markdown report to a file.
    // GitHub artifacts are flattened (folder structure is not preserved), so we include the DAO name in the filename.
    const dir = `./reports/${config.daoName}/${chain}-${config.governorAddress}`
    const proposalId = formatProposalId(proposal.id!)
  
    await generateAndSaveReports(
      chain as CometChains,
      proposalId,
      { start: startBlock, end: endBlock, current: latestBlock },
      proposal,
      checkResults,
      dir,
      compProposalAnalysis,
    )

    await pushCompoundChecksToDiscord(
      proposal,
      checkResults,
      compProposalAnalysis,
    )

    const reportPath = `reports/${config.daoName}/${config.governorAddress}/${proposal.id}`
    await uploadFileToS3(`${s3ReportsFolder}/${proposal.id}.md`, `${reportPath}.md`)
    await uploadFileToS3(`${s3ReportsFolder}/${proposal.id}.pdf`, `${reportPath}.pdf`)
    await uploadFileToS3(`${s3ReportsFolder}/${proposal.id}.html`, `${reportPath}.html`)

    await pushCompoundChecksToEmail(chain as CometChains, proposal.id!.toString(), checkResults, compProposalAnalysis, s3ReportsFolder)
  }
  console.log('Done!')
}
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
