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

# TODO
- how to store calldatas if there are multiple calls to the same function many times in the same proposal
  e.g. 
  ```json
  "253": [
            "0x1B0e765F6224C21223AeA2af16c1C46E38885a40",
            "28000000000000000000000",
            "0x6d903f6003cca6255D85CcA4D3B5E5146dC33925",
            "3600000000000000000000",
            "0x6d903f6003cca6255D85CcA4D3B5E5146dC33925",
            "2250000000000000000000"
          ]
  ```




  
  
