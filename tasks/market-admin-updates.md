# Market update

- have a separate `market-updates.ts` file similar to the `index.ts` file
- update the cron job to run the `market-updates.ts` file as well after every two hour
- index.ts file changes needed to make the market-updates.ts file:
  - when getting all proposal ids, instead of checking for `ProposalCreated` event, we gotta check for `MarketUpdateProposalCreated` event
  - storing and retreiving market update reports from s3
  - inferring governor type will fall to `oz` cause `MarketUpdateProposer` doesnt have a ``initialProposalId`` function
  - store governor (MarketUpdateProposer) address for each chain
  - have to use `customProvider` instead of the simple `provider` being used cause simple `provider` is using `mainnet` rpc url
  - maybe we need to define a separate governor file cause the `MarketUpdateProposer` contract doesnt have everything 
- `tenderly.ts` file needs changing:
  - when getting logs, instead of checking for `ProposalCreated`/`ProposalExecuted` event, we gotta check for `MarketUpdateProposalCreated`/`MarketUpdateProposalExecuted` event
  - instead of using `provider`, we have to use `customProvider` cause simple `provider` is using `mainnet` rpc url
- need to handle the logic where we are storing the target lookup and formatters
- maybe create a separate discord webhook for market updates notifications or we can just change the heading 
- add check boxes on email subscription ui lambda to select which updates to receive compound/market or both