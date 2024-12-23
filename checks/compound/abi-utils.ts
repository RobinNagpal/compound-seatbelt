import { FunctionFragment, Interface, Result } from '@ethersproject/abi'
import fs from 'fs'
import mftch from 'micro-ftch'
import { CometChains, ContractNameAndAbi, ExecuteTransactionInfo } from './compound-types'
import { diffString } from 'json-diff'

// @ts-ignore
const fetchUrl = mftch.default

interface FunctionFragmentAndDecodedCalldata {
  fun: FunctionFragment;
  decodedCalldata: Result
}

export async function getContractNameAndAbiFromFile(chain: CometChains, addr: string): Promise<ContractNameAndAbi> {
  const address = addr.toLowerCase()
  // read abi from file in contracts folder
  const abiFilePath = getContractInfoFilePath(chain, address)
  if (fs.existsSync(abiFilePath)) {
    const fileContent = fs.readFileSync(abiFilePath, 'utf-8')
    const abiFile = JSON.parse(fileContent)
    return { abi: abiFile.abi, contractName: abiFile.contractName }
  } else {
    await storeContractNameAndAbi(chain, address)
    return getContractNameAndAbiFromFile(chain, address)
  }
}

async function storeContractNameAndAbi(chain: CometChains, addr: string) {
  const address = addr.toLowerCase()
  const { contractName, abi } = await getContractNameAndAbi(chain, address)
  const abiFilePath = getContractInfoFilePath(chain, address)
  const abiFileContent = JSON.stringify({ abi, contractName, address }, null, 2)
  fs.writeFileSync(abiFilePath, abiFileContent, 'utf-8')
}

async function getContractNameAndAbi(chain: CometChains, address: string): Promise<ContractNameAndAbi> {
  console.log(`Fetching contract name and ABI for address: ${address} on chain: ${chain}...`)
  // Add delay to avoid rate limiting from etherscan api
  await delay(2000)
  console.log('Fetching contract name and ABI for address:', address)
  const contractResponse = await fetchUrl(getExplorerApiUrl(chain, address))

  const contractResult = contractResponse.result[0]

  if (contractResult.Implementation) {
    const implResponse = await fetchUrl(getExplorerApiUrl(chain, contractResult.Implementation))
    const implResult = implResponse.result[0]

    const abi = implResult.ABI
    if (!abi) {
      console.log('No ABI found for address:', address, implResponse)
      throw new Error('No ABI found for address ' + address)
    }

    const contractNameAndAbi = {
      contractName: implResult.ContractName,
      abi: abi,
    }
    return contractNameAndAbi
  } else {
    const abi = contractResult.ABI
    if (!abi) {
      console.log('No ABI found for address:', address, contractResponse)
      throw new Error('No ABI found for address ' + address)
    }
    const contractNameAndAbi = {
      contractName: contractResult.ContractName,
      abi: abi,
    }
    return contractNameAndAbi
  }
}

function getContractInfoFilePath(chain: CometChains, address: string) {
  return `./checks/compound/contracts/${chain}/${address}.json`
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function getExplorerApiUrl(chain: CometChains, address: string) {
  if (chain === CometChains.mainnet) {
    return `https://api.etherscan.io/api?module=contract&action=getsourcecode&address=${address}&apikey=${process.env.ETHERSCAN_API_KEY}`
  } else if (chain === CometChains.polygon) {
    return `https://api.polygonscan.com/api?module=contract&action=getsourcecode&address=${address}&apikey=${process.env.POLYGONSCAN_API_KEY}`
  } else if (chain === CometChains.arbitrum) {
    return `https://api.arbiscan.io/api?module=contract&action=getsourcecode&address=${address}&apikey=${process.env.ARBITRUMSCAN_API_KEY}`
  } else if (chain === CometChains.base) {
    return `https://api.basescan.org/api?module=contract&action=getsourcecode&address=${address}&apikey=${process.env.BASESCAN_API_KEY}`
  } else if (chain === CometChains.scroll) {
    return `https://api.scrollscan.com/api?module=contract&action=getsourcecode&address=${address}&apikey=${process.env.SCROLL_API_KEY}`
  } else if (chain === CometChains.optimism) {
    return `https://api-optimistic.etherscan.io/api?module=contract&action=getsourcecode&address=${address}&apikey=${process.env.OPTIMISM_API_KEY}`
  } else if (chain === CometChains.mantle) {
    return `https://api.mantlescan.xyz/api?module=contract&action=getsourcecode&address=${address}&apikey=${process.env.MANTLE_API_KEY}`
  } else {
    throw new Error('Unknown chain: ' + chain)
  }
}

export function getExplorerBaseUrl(chain: CometChains) {
  if (chain === CometChains.mainnet) {
    return `https://etherscan.io/address/`
  } else if (chain === CometChains.polygon) {
    return `https://polygonscan.com/address/`
  } else if (chain === CometChains.arbitrum) {
    return `https://arbiscan.io/address/`
  } else if (chain === CometChains.base) {
    return `https://basescan.org/address/`
  } else if (chain === CometChains.scroll) {
    return `https://scrollscan.com/address/`
  } else if (chain === CometChains.optimism) {
    return `https://optimistic.etherscan.io/address/`
  } else if (chain === CometChains.mantle) {
    return `https://mantlescan.xyz/address/`
  } else {
    throw new Error('Unknown chain: ' + chain)
  }
}

export async function getFunctionFragmentAndDecodedCalldata(proposalId: number, chain: CometChains, transactionInfo: ExecuteTransactionInfo): Promise<FunctionFragmentAndDecodedCalldata> {
  const { target, signature, calldata } = transactionInfo
  const contractNameAndAbi = await getContractNameAndAbiFromFile(chain, target)

  if (!contractNameAndAbi.abi) {
    console.log('No ABI found for address:', target)
    throw new Error('No ABI found for address ' + target)
  }
  const iface = new Interface(contractNameAndAbi.abi)

  let decodedCalldata
  let fun: FunctionFragment
  try {
    if (signature.trim()) {
      fun = iface.getFunction(signature)
      decodedCalldata = iface._decodeParams(fun.inputs, calldata)
    } else {
      fun = iface.getFunction(calldata.slice(0, 10))
      const data = calldata.slice(10)
      decodedCalldata = iface._decodeParams(fun.inputs, `0x${data}`)
    }
  } catch (e) {
    console.log(`Error decoding function: ${proposalId} target: ${target} signature: ${signature} calldata:${calldata}`)
    console.log(`ContractName: ${contractNameAndAbi.contractName} chain: ${chain}`)
    console.error(e)
    
    const isModified = await isContractModified(contractNameAndAbi, target, chain)
    if (isModified) {
      await storeContractNameAndAbi(chain, target)
      return getFunctionFragmentAndDecodedCalldata(proposalId, chain, transactionInfo)
    }
    throw e
  }

  return { fun, decodedCalldata }
}

export function getFunctionSignature(fun: FunctionFragment) {
  return `${fun.name}(${fun.inputs.map((input) => input.type).join(',')})`
}

async function isContractModified(contractNameAndAbi: ContractNameAndAbi, target: string, chain: CometChains): Promise<boolean> {
  const {abi: newAbi} = await getContractNameAndAbi(chain, target)
  
  const oldAbiParsed = JSON.parse(contractNameAndAbi.abi.toString())
  const newAbiParsed = JSON.parse(newAbi.toString())
  
  const changes = diffString(oldAbiParsed, newAbiParsed, { color: false, verbose: true })
  const isEqual = JSON.stringify(oldAbiParsed) === JSON.stringify(newAbiParsed);
  
  return Boolean(changes) || !isEqual;
}