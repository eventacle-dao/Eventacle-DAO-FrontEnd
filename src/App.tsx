import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { DevPage } from './pages/DevPage'
import { DevPOAPPage } from './pages/DevPOAPPage'
import './App.css'

function HomePage() {
  return (
    <div className="min-h-svh flex flex-col items-center justify-center gap-6 p-6">
      <header className="flex items-center justify-between w-full max-w-4xl">
        <h1 className="text-2xl font-semibold">Eventacle DAO</h1>
        <ConnectButton showBalance={false} />
      </header>
      <main className="flex flex-col items-center gap-8 w-full max-w-4xl text-center">
        <p className="text-muted-foreground">欢迎使用 Eventacle DAO</p>
        <Link
          to="/dev"
          className="rounded bg-primary text-primary-foreground px-6 py-3 text-sm font-medium hover:opacity-90"
        >
          进入开发页面 / Dev
        </Link>
      </main>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/dev" element={<DevPage />} />
        <Route path="/dev/poap/:address" element={<DevPOAPPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
