import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { injective, injectiveTestnet } from 'wagmi/chains'

export const config = getDefaultConfig({
  appName: 'Eventacle DAO',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? 'YOUR_PROJECT_ID',
  chains: [injective, injectiveTestnet],
  ssr: false,
})
