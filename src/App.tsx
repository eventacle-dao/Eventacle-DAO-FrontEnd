import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useBalance, useConnection } from 'wagmi'
// import { Button } from '@/components/ui/button'
import './App.css'

function App() {
  const connection = useConnection()
  const { data: balance, isLoading: isBalanceLoading } = useBalance({
    address: connection.address,
  })

  return (
    <div className="min-h-svh flex flex-col items-center justify-center gap-6 p-6">
      <header className="flex items-center justify-between w-full max-w-4xl">
        <h1 className="text-2xl font-semibold">Eventacle DAO</h1>
        <ConnectButton showBalance={false} />
      </header>
      <main className="flex flex-col items-center gap-4">
        {connection.status === 'connected' && (
          <div className="rounded-lg border bg-card px-4 py-3 text-card-foreground">
            <p className="text-sm text-muted-foreground">当前链上余额</p>
            <p className="text-lg font-medium tabular-nums">
              {isBalanceLoading
                ? '加载中…'
                : balance != null
                  ? `${(Number(balance.value) / 10 ** balance.decimals).toFixed(6)} ${balance.symbol}`
                  : '—'}
            </p>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
