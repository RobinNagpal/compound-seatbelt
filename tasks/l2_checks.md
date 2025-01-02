Next tasks

# Adding State changes by Chain into the report
- We can add mainnet changes as heading and the existing content goes into it
- We can then add l2 chain names and add the state changes for each of them to it.

# Making it work for every L2 supported. 
We might have to adjust the code a bit to update the state according to the L2 we are testing for.

# Report transaction failures
- we create a new check which will just check if transaction passed or not, on mainnet and on each L2 chain

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
  - no such override for arbitrum and polygon, scroll has override but tenderly doesnt support it so 
- in `tenderly.ts` in `simulateBridgedTransactions` - I will add a getter function to get the `from` for the create payload for each L2 chain.
  - because for each chain, the sender would be different
- in `tenderly.ts` in `simulateBridgedTransactions` - I will add a getter function to get the `input` for the payloads for each L2 chain.
  - because for each chain, the input format would be different

# Report transaction failures
- two cases:
  - when we get a exeception from fetch call tenderly
    - we can set `success` equal to `false` and `sim` would be `undefined` in this case
    - send `sim` to generate report and check if `success` is false, if yes, then we can add a heading `Simulation` and under it we can add the error message that `Simulation Failed for <chain name>`
  - when the transaction reverts
    - we can look for the error message field in the `sim`
    - send `sim` to generate report and check for `success`, if true, then we can get the error message from the `sim` and add a heading `Simulation` and under it we can add the error message that `Transaction Failed for <chain name> with reason <error message>`
- fix the types changes that are needed after making the `sim` optional