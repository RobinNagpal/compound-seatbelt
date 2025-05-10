import { getAddress } from '@ethersproject/address'
import { BigNumber, BigNumberish } from '@ethersproject/bignumber'
import { hexStripZeros } from '@ethersproject/bytes'
import mftch, { FETCH_OPT } from 'micro-ftch'

import { StorageEncodingResponse, TenderlyBundledSimulation, TenderlyPayload, TenderlySimulation } from '../../types'
import {
  BLOCK_GAS_LIMIT,
  TENDERLY_ACCESS_TOKEN,
  TENDERLY_BASE_URL,
  TENDERLY_ENCODE_URL,
  TENDERLY_SIM_BUNDLE_URL,
  TENDERLY_SIM_URL,
} from '../constants'

// @ts-ignore
const fetchUrl = mftch.default

const TENDERLY_FETCH_OPTIONS = { type: 'json', headers: { 'X-Access-Key': TENDERLY_ACCESS_TOKEN } }

// --- Interfaces and Types ---

export interface SimulationPayloadParams {
  networkId: string
  blockNumber: number
  from: string
  to: string
  input: string
  gas: number
  gasPrice?: string
  value: string
  simBlock: BigNumber
  simTimestamp: BigNumber | string
  stateObjects: Record<string, any>
}

/**
 * Sleep for the specified number of milliseconds
 * @param delay Time to sleep in milliseconds
 */
const sleep = (delay: number) => new Promise((resolve) => setTimeout(resolve, delay))

/**
 * Get a random integer between two values
 * @param min Minimum value (inclusive)
 * @param max Maximum value (exclusive)
 */
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min) + min)

/**
 * Gets the latest block number known to Tenderly
 * @param chainId Chain ID to get block number for
 */
export async function getLatestBlock(chainId: BigNumberish): Promise<number> {
  try {
    // Send simulation request
    const url = `${TENDERLY_BASE_URL}/network/${BigNumber.from(chainId).toString()}/block-number`
    const fetchOptions = <Partial<FETCH_OPT>>{ method: 'GET', ...TENDERLY_FETCH_OPTIONS }
    const res = await fetchUrl(url, fetchOptions)
    return res.block_number as number
  } catch (err) {
    console.log('logging getLatestBlock error')
    console.log(JSON.stringify(err, null, 2))
    throw err
  }
}

// --- API Request Handling ---

/**
 * @notice Encode state overrides
 * @param payload State overrides to send
 */
export async function sendEncodeRequest(payload: any): Promise<StorageEncodingResponse> {
  try {
    const fetchOptions = <Partial<FETCH_OPT>>{
      method: 'POST',
      data: payload,
      ...TENDERLY_FETCH_OPTIONS,
    }
    const response = await fetchUrl(TENDERLY_ENCODE_URL, fetchOptions)

    return response as StorageEncodingResponse
  } catch (err) {
    console.log('logging sendEncodeRequest error')
    console.log(JSON.stringify(err, null, 2))
    throw err
  }
}

/**
 * @notice Base function to send API requests to Tenderly with retries
 * @param url API endpoint URL
 * @param data Request payload
 * @param delay Initial delay for retry (ms)
 * @returns API response
 */
export async function sendTenderlyRequest<T>(url: string, data: any, delay = 1000): Promise<T> {
  const fetchOptions = <Partial<FETCH_OPT>>{
    method: 'POST',
    data,
    ...TENDERLY_FETCH_OPTIONS,
  }

  try {
    return (await fetchUrl(url, fetchOptions)) as T
  } catch (err: any) {
    console.log(`Error in Tenderly API request: ${JSON.stringify(err)}`)
    const is429 = typeof err === 'object' && err?.statusCode === 429

    if (delay > 8000 || !is429) {
      console.warn(`Request failed with the below payload and error`)
      console.log(JSON.stringify(fetchOptions))
      throw err
    }

    console.warn(err)
    console.warn(`Request failed with the above error, retrying in ~${delay} milliseconds. See request payload below`)
    console.log(JSON.stringify(data))

    await sleep(delay + randomInt(0, 1000))
    return sendTenderlyRequest<T>(url, data, delay * 2)
  }
}

/**
 * @notice Sends a transaction simulation request to the Tenderly API
 * @param payload Transaction simulation parameters
 */
export async function sendSimulation(payload: TenderlyPayload): Promise<TenderlySimulation> {
  const sim = await sendTenderlyRequest<TenderlySimulation>(TENDERLY_SIM_URL, payload)

  // Post-processing to ensure addresses are checksummed
  sim.transaction.addresses = sim.transaction.addresses.map(getAddress)
  sim.contracts.forEach((contract) => (contract.address = getAddress(contract.address)))

  return sim
}

/**
 * @notice Sends a bundle simulation request to the Tenderly API
 * @param payload Array of transaction simulation payloads
 */
export async function sendBundleSimulation(payload: TenderlyPayload[]): Promise<TenderlyBundledSimulation> {
  const bundledSim = await sendTenderlyRequest<TenderlyBundledSimulation>(TENDERLY_SIM_BUNDLE_URL, {
    simulations: payload,
  })

  // Post-processing to ensure addresses are checksummed
  bundledSim.simulation_results.forEach((sim) => {
    if (sim.transaction && sim.contracts.length > 0) {
      sim.transaction.addresses = sim.transaction.addresses.map(getAddress)
      sim.contracts.forEach((contract) => (contract.address = getAddress(contract.address)))
    }
  })

  return bundledSim
}

/**
 * @notice Creates a simulation payload for Tenderly
 * @param params Parameters for the simulation payload
 */
export function createSimulationPayload(params: SimulationPayloadParams): TenderlyPayload {
  const { networkId, blockNumber, from, to, input, gas, gasPrice, value, simBlock, simTimestamp, stateObjects } = params

  return {
    network_id: networkId,
    block_number: blockNumber,
    from,
    to,
    input,
    gas: gas || BLOCK_GAS_LIMIT,
    gas_price: gasPrice || '0',
    value,
    save_if_fails: true,
    save: true,
    generate_access_list: true,
    block_header: {
      number: hexStripZeros(simBlock.toHexString()),
      timestamp: typeof simTimestamp === 'string' ? simTimestamp : hexStripZeros(simTimestamp.toHexString()),
    },
    state_objects: stateObjects,
  }
}
