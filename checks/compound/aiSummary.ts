import OpenAI from 'openai'
import axios from 'axios'
import { getContractNameAndAbiFromFile, getExplorerApiUrl, getExplorerBaseUrl } from './abi-utils'
import { CometChains } from './compound-types'
import { Result } from 'ethers/lib/utils'

export async function generateAISummary(chain: CometChains, target: string, signature: string, decodedCalldata: Result, isNotAIGenerated: boolean = false) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })

  let sourceCode: any = {}
  let argumentAddresses: string[] = []
  let contracts: Record<string, string> = {}

  try {
    const baseExplorerUrl = getExplorerBaseUrl(chain)

    sourceCode = await getSourceCode(chain, target)
    argumentAddresses = getAddressArgumentsFromCalldata(signature, decodedCalldata)
    contracts = await getContractNamesList(chain, target, argumentAddresses)

    const contractList = Object.entries(contracts)
      .map(([name, address]) => `${name}: ${address}`)
      .join('\n')

    const prompt = `
I want to write a one-line non-technical summary of the action performed by the following function call. I will also provide the source of the contract with its dependencies. Please give me the summary in this format:

[USDT - 0x371DB...E02](${baseExplorerUrl}/0x371DB45c7ee248dAFf4Dc1FFB67A20faa0ecFE02) transferred from [EOA Wallet - 0x81Bc6...eC6](${baseExplorerUrl}0x81Bc6016Fa365bfE929a51Eec9217B441B598eC6) to a [Safe Wallet - 0xB6Ef3...5F9](${baseExplorerUrl}0xB6Ef3AC71E9baCF1F4b9426C149d855Bfc4415F9).

This is the summary for this call:
0x81Bc6016Fa365bfE929a51Eec9217B441B598eC6.transfer(address, address) called with (0x371DB45c7ee248dAFf4Dc1FFB67A20faa0ecFE02, 0xB6Ef3AC71E9baCF1F4b9426C149d855Bfc4415F9)

I want to use these human-readable names with smaller identifiable addresses with hyperlinks to the online contract. All hyperlinks will have the base URL as ${baseExplorerUrl}, and the address URL will be of the format ${baseExplorerUrl}<address>.

Here is the information of the call:
${target}.${signature} called with :** (${decodedCalldata.join(',')})

Here are the contract addresses and names:
${contractList}

Here is the source code of the target contract:
${sourceCode}

Just return the summary.
`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant generating summaries for Smart contract calls.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
    })

    const message = response?.choices?.[0]?.message?.content
    if (!message) {
      console.error('Response from AI is empty, falling back to default formatter.')
      return await defaultFormatter(chain, target, signature, decodedCalldata)
    }
    
    if (isNotAIGenerated) {
      return (message.trim())
    }
    return formatAISummary(message.trim())
  } catch (error) {
    console.error('Error generating AI summary:', error)
    return await defaultFormatter(chain, target, signature, decodedCalldata)
  }
}

async function getSourceCode(chain: CometChains, address: string) {
  const sourceCodeUrl = getExplorerApiUrl(chain, address)
  try {
    const response = await axios.get(sourceCodeUrl)
    if (response.data && response.data.result && response.data.result.length > 0) {
      return response.data.result[0]
    } else {
      console.error(`No source code found for this contract: ${address}`)
      return {}
    }
  } catch (error) {
    console.error(`Error fetching contract source code for ${address}: `, error)
    return {}
  }
}

function getAddressArgumentsFromCalldata(signature: string, decodedCalldata: Result): string[] {
  try {
    const argsMatch = /\((.*)\)/.exec(signature)
    if (!argsMatch || !argsMatch[1]) {
      console.error(`Invalid function signature: ${signature}`)
      return []
    }

    const argTypes = argsMatch[1].split(',').map((arg) => arg.trim())
    const addressPositions = argTypes.reduce<number[]>((positions, type, index) => {
      if (type === 'address') {
        positions.push(index)
      }
      return positions
    }, [])

    const addressValues = addressPositions.map((pos) => decodedCalldata[pos]?.toString())
    return addressValues
  } catch (error) {
    console.error(`Error getting address arguments from calldata for signature ${signature}:`, error)
    return []
  }
}

async function getContractNamesList(chain: CometChains, target: string, argumentAddresses: string[]): Promise<Record<string, string>> {
  const contractNamesList: Record<string, string> = {}

  async function fetchAndAddContractName(address: string): Promise<void> {
    try {
      const { contractName } = await getContractNameAndAbiFromFile(chain, address)
      if (contractName) {
        contractNamesList[contractName] = address
      }
    } catch (error) {
      console.error(`Failed to fetch contract name for address: ${address}`, error)
    }
  }

  await fetchAndAddContractName(target)
  for (const address of argumentAddresses) {
    await fetchAndAddContractName(address)
  }

  return contractNamesList
}

function formatAISummary(summary: string) {
  console.log("No function formatter found. Generating summary using AI...");
  return 'No function formatter found. AI Generated: \n' + summary
}

async function defaultFormatter(chain: CometChains, target: string, functionSignature: string, decodedCalldata: Result) {
  try {
    const { contractName } = await getContractNameAndAbiFromFile(chain, target)
    return `The function **${functionSignature}** was called on the contract **${contractName}** with the following parameters:\n- ${decodedCalldata.join(
      ', '
    )}`
  } catch (error) {
    console.error('Error in default formatter:', error)
    return `The function **${functionSignature}** was called on ${target} with parameters: ${decodedCalldata.join(', ')}`
  }
}
