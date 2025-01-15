Next tasks

# Things to do to make the registry
- make function `storeTargetLookupData()` to store `TargetLookupData` into respective files e.g. `mainnetTargetLookup.json` and create the file if it doesnt already exist
- `storeTargetLookupData()` will also store the below data structure into `target-registry.json`:
  ```json
  {
    'mainnet': {
      '0x0000000000000...':'<ContractName>',
      '0x0000000000000...':'<ContractName>',
      '0x0000000000000...':'<ContractName>'
    },
    'arbitrum': {
      '0x0000000000000...':'<ContractName>',
      '0x0000000000000...':'<ContractName>',
      '0x0000000000000...':'<ContractName>'
    }
    
  }
  ```
- call the `storeTargetLookupData()` in the `getTransactionMessages()` in `check-compound-proposal-details.ts`









  
  
