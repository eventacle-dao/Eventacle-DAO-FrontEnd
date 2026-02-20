import '@rainbow-me/rainbowkit/styles.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { WagmiProvider } from 'wagmi'
import { config } from './config/wagmi'
import { Buffer } from 'buffer'
import './index.css'
import App from './App.tsx'

const queryClient = new QueryClient()

if (typeof window !== 'undefined' && typeof (window as unknown as Window & { Buffer?: typeof Buffer }).Buffer === 'undefined') {
  ;(window as unknown as Window & { Buffer: typeof Buffer }).Buffer = Buffer
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <App />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
)
