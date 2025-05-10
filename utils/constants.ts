import dotenv from 'dotenv'
dotenv.config()

// Load environment variables.
export const ETHERSCAN_API_KEY: string = process.env.ETHERSCAN_API_KEY!
export const POLYGONSCAN_API_KEY: string = process.env.POLYGONSCAN_API_KEY!
export const BASESCAN_API_KEY: string = process.env.BASESCAN_API_KEY!
export const ARBITRUMSCAN_API_KEY: string = process.env.ARBITRUMSCAN_API_KEY!
export const OPTIMISMIC_ETHERSCAN_API_KEY: string = process.env.OPTIMISM_API_KEY!
export const SCROLLSCAN_API_KEY: string = process.env.SCROLL_API_KEY!
export const MANTLESCAN_API_KEY: string = process.env.MANTLE_API_KEY!
export const UNISCAN_API_KEY: string = process.env.UNISCAN_API_KEY!

export const RPC_URL_MAINNET: string = process.env.RPC_URL_MAINNET!
export const RPC_URL_POLYGON: string = process.env.RPC_URL_POLYGON!
export const RPC_URL_BASE: string = process.env.RPC_URL_BASE!
export const RPC_URL_SCROLL: string = process.env.RPC_URL_SCROLL!
export const RPC_URL_ARBITRUM: string = process.env.RPC_URL_ARBITRUM!
export const RPC_URL_OPTIMISM: string = process.env.RPC_URL_OPTIMISM!
export const RPC_URL_MANTLE: string = process.env.RPC_URL_MANTLE!
export const RPC_URL_UNICHAIN: string = process.env.RPC_URL_UNICHAIN!

export const TENDERLY_ACCESS_TOKEN: string = process.env.TENDERLY_ACCESS_TOKEN!
export const TENDERLY_USER: string = process.env.TENDERLY_USER!
export const TENDERLY_PROJECT_SLUG: string = process.env.TENDERLY_PROJECT_SLUG!

// Validate them.
if (!ETHERSCAN_API_KEY) throw new Error('ETHERSCAN_API_KEY is not defined')
if (!POLYGONSCAN_API_KEY) throw new Error('POLYGONSCAN_API_KEY is not defined')
if (!BASESCAN_API_KEY) throw new Error('BASESCAN_API_KEY is not defined')
if (!ARBITRUMSCAN_API_KEY) throw new Error('ARBITRUMSCAN_API_KEY is not defined')
if (!OPTIMISMIC_ETHERSCAN_API_KEY) throw new Error('OPTIMISM_API_KEY is not defined')
if (!SCROLLSCAN_API_KEY) throw new Error('SCROLL_API_KEY is not defined')
if (!MANTLESCAN_API_KEY) throw new Error('MANTLE_API_KEY is not defined')
if (!RPC_URL_UNICHAIN) throw new Error('RPC_URL_UNICHAIN is not defined')

if (!RPC_URL_MAINNET) throw new Error('RPC_URL_MAINNET is not defined')
if (!RPC_URL_POLYGON) throw new Error('RPC_URL_POLYGON is not defined')
if (!RPC_URL_BASE) throw new Error('RPC_URL_BASE is not defined')
if (!RPC_URL_SCROLL) throw new Error('RPC_URL_SCROLL is not defined')
if (!RPC_URL_ARBITRUM) throw new Error('RPC_URL_ARBITRUM is not defined')
if (!RPC_URL_OPTIMISM) throw new Error('RPC_URL_OPTIMISM is not defined')
if (!RPC_URL_MANTLE) throw new Error('RPC_URL_MANTLE is not defined')

if (!TENDERLY_ACCESS_TOKEN) throw new Error('TENDERLY_ACCESS_TOKEN is not defined')
if (!TENDERLY_USER) throw new Error('TENDERLY_USER is not defined')
if (!TENDERLY_PROJECT_SLUG) throw new Error('TENDERLY_PROJECT_SLUG is not defined')

// Define the constants.
export const BLOCK_GAS_LIMIT = 30_000_000
export const TENDERLY_BASE_URL = `https://api.tenderly.co/api/v1`
export const TENDERLY_ENCODE_URL = `${TENDERLY_BASE_URL}/account/${TENDERLY_USER}/project/${TENDERLY_PROJECT_SLUG}/contracts/encode-states`
export const TENDERLY_SIM_URL = `${TENDERLY_BASE_URL}/account/${TENDERLY_USER}/project/${TENDERLY_PROJECT_SLUG}/simulate`
export const TENDERLY_SIM_BUNDLE_URL = `${TENDERLY_BASE_URL}/account/${TENDERLY_USER}/project/${TENDERLY_PROJECT_SLUG}/simulate-bundle`
export const DISCORD_WEBHOOK_URL: string = process.env.DISCORD_WEBHOOK_URL!

// Only required when running a specific sim from a config file
// Note that if SIM_NAME is defined, that simulation takes precedence over scanning mode with GitHub Actions
export const SIM_NAME = process.env.SIM_NAME ? process.env.SIM_NAME : null

// Only required to scan for new proposals and simulate with GitHub Actions
export const DAO_NAME = process.env.DAO_NAME ? process.env.DAO_NAME : null
export const GOVERNOR_ADDRESS = process.env.GOVERNOR_ADDRESS ? process.env.GOVERNOR_ADDRESS : null
export const REPORTS_BRANCH = 'reports'
