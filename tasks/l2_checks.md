Next tasks

# Adding State changes by Chain into the report
- We can add mainnet changes as heading and the existing content goes into it
- We can then add l2 chain names and add the state changes for each of them to it.

# Making it work for every L2 supported. 
We might have to adjust the code a bit to update the state according to the L2 we are testing for.

# Doing the same for other default checks


# Changes expected
# Adding State changes by Chain into the report
List the files and the functions that will need the change and write one line about what needs to be done. There should 
be max of 5-10 of these bullet points which explain the changes. So we want to know from the high level, not line by line change here. 

- in `check-state-changes.ts` in `checkStateChanges` - the code corresponding to populating infos or warnings in same. 
I will extract this to another function and will reuse that function for both mainnet and bridged simulations.

- in `report.ts` in `toMarkdownProposalReport` - I will create a function that will create headings like `Mainnet Changes` and check if bridgedCheckResults are there, create heading `Bridge Changes of <chain name>` and then call `toCheckSummary` for each of them.


# Making it work for every L2 supported. 
- in `tenderly.ts` in `simulateBridgedTransactions` - I will check if the destination chain is scroll then skip the simulation
- in `l2-utils.ts` in `getBridgeReceiverOverrides` - Add overrides for other supported L2s
- in `tenderly.ts` in `simulateBridgedTransactions` - I will add a getter function to get the `from` for the payloads for each L2 chain.