import {
  DAO_NAME,
  GITHUB_REPO_NAME,
  GITHUB_REPO_OWNER,
  GOVERNOR_ADDRESS,
  REPORTS_BRANCH,
} from "./utils/constants";
import { github } from "./utils/clients/github";
import { governorBravo } from "./utils/contracts/governor-bravo";
import { provider } from "./utils/clients/ethers";
import { AllCheckResults, Proposal } from "./types";
import ALL_CHECKS from "./checks";
import { toProposalReport } from "./presentation/markdown";

async function main() {
  const latestBlock = await provider.getBlock("latest");

  const currentDateTime = new Date(latestBlock.timestamp * 1000);
  const formattedDateTime = currentDateTime.toISOString();

  const createProposalLogs = await governorBravo.queryFilter(
    governorBravo.filters.ProposalCreated(),
    0,
    latestBlock.number
  );

  const activeProposals: Proposal[] = createProposalLogs
    .filter(
      (proposal) =>
        proposal.args /*&& proposal.args.endBlock.gte(cu¡rrentBlock)*/
    )
    .map((proposal) => proposal.args as unknown as Proposal);

  for (const proposal of activeProposals) {
    const checkResults: AllCheckResults = Object.fromEntries(
      await Promise.all(
        Object.keys(ALL_CHECKS).map(async (checkId) => [
          checkId,
          {
            name: ALL_CHECKS[checkId].name,
            result: await ALL_CHECKS[checkId].checkProposal(proposal),
          },
        ])
      )
    );

    try {
      const path = `${DAO_NAME}/${GOVERNOR_ADDRESS}/${proposal.id}.md`;

      const [startBlock, endBlock] = await Promise.all([
        proposal.startBlock.toNumber() <= latestBlock.number
          ? provider.getBlock(proposal.startBlock.toNumber())
          : null,
        proposal.endBlock.toNumber() <= latestBlock.number
          ? provider.getBlock(proposal.endBlock.toNumber())
          : null,
      ]);

      let sha: string | undefined;
      try {
        const { data } = await github.rest.repos.getContent({
          owner: GITHUB_REPO_OWNER,
          repo: GITHUB_REPO_NAME,
          ref: REPORTS_BRANCH,
          path,
        });
        if ("sha" in data) {
          sha = data.sha;
        }
      } catch (error) {
        console.warn("Failed to get sha for file at path", path, error);
      }

      await github.rest.repos.createOrUpdateFileContents({
        owner: GITHUB_REPO_OWNER,
        repo: GITHUB_REPO_NAME,
        branch: REPORTS_BRANCH,
        message: `Update ${path} as of ${formattedDateTime}`,
        content: Buffer.from(
          toProposalReport(
            { start: startBlock, end: endBlock, current: latestBlock },
            proposal,
            checkResults
          ),
          "utf-8"
        ).toString("base64"),
        path,
        sha,
      });
    } catch (error) {
      console.error("Failed to update file contents", error);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
