export const INJECTIVE_TESTNET_CHAIN_ID = 1439

function envAddress(key: string): `0x${string}` {
  const v = import.meta.env[key]
  if (typeof v !== 'string' || !v.startsWith('0x')) {
    throw new Error(`Missing or invalid env: ${key}`)
  }
  return v as `0x${string}`
}

const injectiveTestnetAddresses = {
  factory: envAddress('VITE_CONTRACT_FACTORY'),
  reviewStaking: envAddress('VITE_CONTRACT_REVIEW_STAKING'),
  comments: envAddress('VITE_CONTRACT_COMMENTS'),
} as const

export const deployments = {
  [INJECTIVE_TESTNET_CHAIN_ID]: injectiveTestnetAddresses,
} as const

export type DeploymentAddresses = (typeof deployments)[typeof INJECTIVE_TESTNET_CHAIN_ID]

export function getDeploymentAddresses(chainId: number): DeploymentAddresses | null {
  return deployments[chainId as keyof typeof deployments] ?? null
}
