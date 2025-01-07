Next tasks

# Things to check for successful migration
### Events that should be emitted 
- Simulation result #1
  - QueueTransaction x (Number of transactions)
  - ProposalCreated
- Simulation result #2
  - Event related to transaction e.g. UpdateAssetSupplyCap
  - ExecuteTransaction x (Number of transactions)
  - CometDeployed (if there is deployAndUpgradeTo)
  - Upgraded (if there is deployAndUpgradeTo)
  - ProposalExecuted
### Events that i have verified
- Above events are verified for Optimism proposal # 385
- Almost none are present for mantle
### Events I am not sure about
- There are events with no names and their structure also differs from the events that have names

# Finding why logs are not decoded properly
### Possible reasons
- Logs/events doesnt have names so output comes as "Undecoded log: ..."
- Contracts involved are not verified so tenderly doesnt return names of the events
### Things that i have tried
- Try a different payload
- Find a way to pass explorer option to tenderly
### Things that i plan to try next









  
  
