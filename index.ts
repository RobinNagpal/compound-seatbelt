/**
 * @notice Entry point for executing a single proposal against a forked mainnet
 */

import dotenv from 'dotenv'
dotenv.config()

import { analyzeProposal } from './checks/compound/check-compound-proposal-details'
import { listFilesInFolder, uploadFileToS3 } from './checks/compound/s3-utils'
import { BigNumber, Contract } from 'ethers'
import { DAO_NAME, GOVERNOR_ADDRESS, SIM_NAME } from './utils/constants'
import { provider } from './utils/clients/ethers'
import { simulate } from './utils/clients/tenderly'
import { AllCheckResults, GovernorType, SimulationConfig, SimulationConfigBase, SimulationData } from './types'
import ALL_CHECKS from './checks'
import { generateAndSaveReports, pushCompoundChecksToDiscord, pushCompoundChecksToEmail } from './presentation/report'
import { PROPOSAL_STATES } from './utils/contracts/governor-bravo'
import {
  formatProposalId,
  getGovernor,
  getProposalIds,
  getTimelock,
  inferGovernorType,
} from './utils/contracts/governor'
import { getAddress } from '@ethersproject/address'
import { CometChains, GovernanceFlows } from './checks/compound/compound-types'

/**
 * @notice Simulate governance proposals and run proposal checks against them
 */
async function main() {
  console.log('Starting main function with GOVERNOR_ADDRESS: ', GOVERNOR_ADDRESS)

  const s3ReportsFolder = process.env.AWS_BUCKET_BASE_PATH || 'all-proposals'
  // --- Run simulations ---
  // Prepare array to store all simulation outputs
  const simOutputs: SimulationData[] = []

  let governor: Contract
  let governorType: GovernorType

  // Determine if we are running a specific simulation or all on-chain proposals for a specified governor.
  if (SIM_NAME) {
    // If a SIM_NAME is provided, we run that simulation
    const configPath = `./sims/${SIM_NAME}.sim.ts`
    const config: SimulationConfig = await import(configPath).then((d) => d.config) // dynamic path `import` statements not allowed

    const { sim, proposal, latestBlock } = await simulate(config)
    simOutputs.push({ sim, proposal, latestBlock, config })

    governorType = await inferGovernorType(config.governorAddress)
    governor = getGovernor(governorType, config.governorAddress)
  } else {
    // If no SIM_NAME is provided, we get proposals to simulate from the chain
    if (!GOVERNOR_ADDRESS) throw new Error('Must provider a GOVERNOR_ADDRESS')
    if (!DAO_NAME) throw new Error('Must provider a DAO_NAME')
    const latestBlock = await provider.getBlock('latest')

    // Fetch all proposal IDs
    governorType = await inferGovernorType(GOVERNOR_ADDRESS)
    const allProposalIds = await getProposalIds(governorType, GOVERNOR_ADDRESS, latestBlock.number)
    const files = await listFilesInFolder(s3ReportsFolder)
    console.log('files', files)
    const proposalIdsArr =
      process.env.SELECTED_PROPOSALS?.split(',') || allProposalIds.filter((id) => id.toNumber() > 438)

    const proposalIds = proposalIdsArr.map((id) => BigNumber.from(id))

    governor = getGovernor(governorType, GOVERNOR_ADDRESS)

    // If we aren't simulating all proposals, filter down to just the active ones. For now we
    // assume we're simulating all by default
    const states = await Promise.all(proposalIds.map((id) => governor.state(id)))
    const simProposals: { id: BigNumber; simType: SimulationConfigBase['type'] }[] = proposalIds.map((id, i) => {
      // If state is `Executed` (state 7), we use the executed sim type and effectively just
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
        .map((id) => formatProposalId(governorType, id))
        .join(', ')}`,
    )

    for (const simProposal of simProposals) {
      if (simProposal.simType === 'new') throw new Error('Simulation type "new" is not supported in this branch')
      // Determine if this proposal is already `executed` or currently in-progress (`proposed`)
      const config: SimulationConfig = {
        type: simProposal.simType,
        daoName: DAO_NAME,
        governorAddress: getAddress(GOVERNOR_ADDRESS),
        governorType,
        proposalId: simProposal.id,
      }

      const pdfExists = files.includes(`${s3ReportsFolder}/${simProposal.id.toString()}.pdf`)

      if (!process.env.SELECTED_PROPOSALS && pdfExists) {
        console.log(`Skipping simulation for proposal ${simProposal.id}  as PDF already exists in S3...`)
        continue
      }

      console.log(
        `  Simulating ${DAO_NAME} proposal ${simProposal.id}... with governor type ${config.governorType} and sim type ${simProposal.simType}`,
      )
      const { sim, proposal, latestBlock } = await simulate(config)
      simOutputs.push({ sim, proposal, latestBlock, config })
      console.log(`done`)
    }
  }

  // --- Run proposal checks and save output ---
  // Generate the proposal data and dependencies needed by checks
  const proposalData = {
    governor,
    provider,
    timelock: await getTimelock(governorType, governor.address),
    chain: CometChains.mainnet,
  }

  for (const simOutput of simOutputs) {
    console.log('Starting proposal checks and report generation...')
    // Run checks
    const { sim, proposal, latestBlock, config } = simOutput
    console.log(`  Running for proposal ID ${formatProposalId(governorType, proposal.id!)}...`)

    const checksToRun = Object.keys(ALL_CHECKS)
      .filter((key) => (process.env.ENABLED_CHECKS ? process.env.ENABLED_CHECKS.split(',').includes(key) : true))
      .filter((key) => {
        return String(process.env.SKIP_DEFAULT_CHECKS).toLowerCase() !== 'true'
      })
    console.log(`Running ${checksToRun.length} checks: ${checksToRun.join(', ')} for proposal ID ${proposal.id!}`)
    const checkResults: AllCheckResults = {}
    for (const checkToRun of checksToRun) {
      console.log(`Running check ${checkToRun}...`)
      checkResults[checkToRun] = {
        name: ALL_CHECKS[checkToRun].name,
        result: await ALL_CHECKS[checkToRun].checkProposal(proposal, sim, proposalData),
      }
    }
    const compProposalAnalysis =
      process.env.DISABLE_COMPOUND_CHECKS === 'true'
        ? { mainnetActionAnalysis: [], chainedProposalAnalysis: [] }
        : await analyzeProposal(proposal, sim, proposalData, GovernanceFlows.main)

    // Generate markdown report.
    const [startBlock, endBlock] = await Promise.all([
      proposal.startBlock.toNumber() <= latestBlock.number ? provider.getBlock(proposal.startBlock.toNumber()) : null,
      proposal.endBlock.toNumber() <= latestBlock.number ? provider.getBlock(proposal.endBlock.toNumber()) : null,
    ])

    // Save markdown report to a file.
    // GitHub artifacts are flattened (folder structure is not preserved), so we include the DAO name in the filename.
    const dir = `./reports/${config.daoName}/${config.governorAddress}`
    const proposalId = formatProposalId(governorType, proposal.id!)
    await generateAndSaveReports(
      CometChains.mainnet,
      proposalId,
      { start: startBlock, end: endBlock, current: latestBlock },
      proposal,
      checkResults,
      dir,
      compProposalAnalysis,
    )

    await pushCompoundChecksToDiscord(
      GovernanceFlows.main,
      proposal,
      checkResults,
      compProposalAnalysis,
      s3ReportsFolder,
    )

    const reportPath = `reports/${config.daoName}/${config.governorAddress}/${proposal.id}`
    await uploadFileToS3(`${s3ReportsFolder}/${proposal.id}.md`, `${reportPath}.md`)
    await uploadFileToS3(`${s3ReportsFolder}/${proposal.id}.pdf`, `${reportPath}.pdf`)
    await uploadFileToS3(`${s3ReportsFolder}/${proposal.id}.html`, `${reportPath}.html`)

    await pushCompoundChecksToEmail(
      CometChains.mainnet,
      GovernanceFlows.main,
      proposal.id!.toString(),
      checkResults,
      compProposalAnalysis,
      s3ReportsFolder,
    )
  }
  console.log('Done!')
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
