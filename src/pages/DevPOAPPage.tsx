import { useEffect, useState } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Link, useParams } from 'react-router-dom'
import {
  useAccount,
  useChainId,
  useReadContract,
  useWriteContract,
} from 'wagmi'
import { activityPOAPAbi } from '../abis'
import { INJECTIVE_TESTNET_CHAIN_ID } from '../config/contracts'

const TIMEZONE = 'Asia/Shanghai'

const IPFS_GATEWAY_BASE =
  typeof import.meta.env.VITE_PINATA_GATEWAY === 'string' &&
  import.meta.env.VITE_PINATA_GATEWAY.trim()
    ? import.meta.env.VITE_PINATA_GATEWAY.trim().replace(/\/$/, '')
    : 'https://gateway.pinata.cloud'

function ipfsOrUriToUrl(uri: string): string {
  const u = uri.trim()
  if (u.startsWith('ipfs://')) return `${IPFS_GATEWAY_BASE}/ipfs/${u.slice(7)}`
  if (u.startsWith('Qm') || u.startsWith('ba')) return `${IPFS_GATEWAY_BASE}/ipfs/${u}`
  if (u.startsWith('/ipfs/')) return `${IPFS_GATEWAY_BASE}${u}`
  return u
}

function extractImageFromMetadata(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const o = data as Record<string, unknown>
  const tryKey = (k: string) => {
    const v = o[k]
    return typeof v === 'string' ? v : null
  }
  return (
    tryKey('image') ||
    tryKey('image_url') ||
    tryKey('image_uri') ||
    tryKey('icon') ||
    tryKey('thumbnail') ||
    (o.attributes && Array.isArray(o.attributes)
      ? (o.attributes as { trait_type?: string; value?: string }[]).find(
          (a) => a.trait_type === 'image' && typeof a.value === 'string',
        )?.value ?? null
      : null)
  )
}

function formatUnixToLocal(unixSeconds: bigint | number): string {
  const date = new Date(Number(unixSeconds) * 1000)
  return date.toLocaleString('zh-CN', {
    timeZone: TIMEZONE,
    dateStyle: 'long',
    timeStyle: 'short',
    hour12: false,
  })
}

function usePoapAddress(): `0x${string}` | null {
  const { address: paramAddress } = useParams<{ address: string }>()
  if (!paramAddress || !paramAddress.startsWith('0x') || paramAddress.length < 42)
    return null
  return paramAddress as `0x${string}`
}

function MintedTokenRow({
  tokenId,
  poapAddress,
}: {
  tokenId: number
  poapAddress: `0x${string}`
}) {
  const { data: owner } = useReadContract({
    address: poapAddress,
    abi: activityPOAPAbi,
    functionName: 'ownerOf',
    args: [BigInt(tokenId)],
  })
  const { data: tokenURI } = useReadContract({
    address: poapAddress,
    abi: activityPOAPAbi,
    functionName: 'tokenURI',
    args: [BigInt(tokenId)],
  })
  const { data: mintedAt } = useReadContract({
    address: poapAddress,
    abi: activityPOAPAbi,
    functionName: 'mintedAt',
    args: [BigInt(tokenId)],
  })

  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageLoadFailed, setImageLoadFailed] = useState(false)
  useEffect(() => {
    setImageLoadFailed(false)
  }, [tokenURI])
  useEffect(() => {
    if (!tokenURI || typeof tokenURI !== 'string') {
      setImageUrl(null)
      return
    }
    const uri = tokenURI.trim()
    const fallbackDirect = /\.(png|jpg|jpeg|webp|gif|svg)(\?|$)/i.test(uri) || uri.startsWith('ipfs://')
    let cancelled = false
    const metaUrl = ipfsOrUriToUrl(uri)
    fetch(metaUrl)
      .then((res) => {
        const ct = res.headers.get('content-type') ?? ''
        if (ct.startsWith('image/')) {
          if (!cancelled) setImageUrl(metaUrl)
          return null
        }
        return res.ok ? res.json() : null
      })
      .then((data) => {
        if (cancelled) return
        const raw = data ? extractImageFromMetadata(data) : null
        if (raw) {
          setImageUrl(ipfsOrUriToUrl(raw))
        } else if (fallbackDirect) {
          setImageUrl(ipfsOrUriToUrl(uri))
        } else {
          setImageUrl(null)
        }
      })
      .catch(() => {
        if (!cancelled && fallbackDirect) setImageUrl(ipfsOrUriToUrl(uri))
        else if (!cancelled) setImageUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [tokenURI])

  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-2 pr-4 font-mono tabular-nums">{tokenId}</td>
      <td className="py-2 pr-4 align-middle">
        {imageUrl && !imageLoadFailed ? (
          <img
            src={imageUrl}
            alt={`Token #${tokenId}`}
            className="w-12 h-12 object-cover rounded border border-border"
            onError={() => setImageLoadFailed(true)}
          />
        ) : (
          <span className="inline-flex w-12 h-12 items-center justify-center rounded border border-border bg-muted/50 text-muted-foreground text-xs">
            无图
          </span>
        )}
      </td>
      <td className="py-2 pr-4 font-mono break-all text-xs">
        {owner != null ? String(owner) : '—'}
      </td>
      <td className="py-2 pr-4 max-w-[200px] truncate text-xs" title={tokenURI != null ? String(tokenURI) : ''}>
        {tokenURI != null ? String(tokenURI) : '—'}
      </td>
      <td className="py-2 text-sm text-muted-foreground">
        {mintedAt != null ? formatUnixToLocal(Number(mintedAt)) : '—'}
      </td>
    </tr>
  )
}

export function DevPOAPPage() {
  const chainId = useChainId()
  const { address: userAddress, isConnected } = useAccount()
  const poapAddress = usePoapAddress()
  const isTestnet = chainId === INJECTIVE_TESTNET_CHAIN_ID

  const { data: poapName } = useReadContract({
    address: poapAddress ?? undefined,
    abi: activityPOAPAbi,
    functionName: 'name',
  })
  const { data: poapSymbol } = useReadContract({
    address: poapAddress ?? undefined,
    abi: activityPOAPAbi,
    functionName: 'symbol',
  })
  const { data: totalSupply } = useReadContract({
    address: poapAddress ?? undefined,
    abi: activityPOAPAbi,
    functionName: 'totalSupply',
  })
  const { data: creator } = useReadContract({
    address: poapAddress ?? undefined,
    abi: activityPOAPAbi,
    functionName: 'creator',
  })
  const { data: contractURI } = useReadContract({
    address: poapAddress ?? undefined,
    abi: activityPOAPAbi,
    functionName: 'contractURI',
  })
  const { data: myBalance } = useReadContract({
    address: poapAddress ?? undefined,
    abi: activityPOAPAbi,
    functionName: 'balanceOf',
    args: userAddress != null ? [userAddress] : undefined,
  })
  const { data: isMinter } = useReadContract({
    address: poapAddress ?? undefined,
    abi: activityPOAPAbi,
    functionName: 'minters',
    args: userAddress != null ? [userAddress] : undefined,
  })

  const {
    mutate: writeMutate,
    isPending: isWritePending,
    error: writeError,
    data: writeHash,
  } = useWriteContract()

  const [mintTo, setMintTo] = useState('')
  const [mintMetadataURI, setMintMetadataURI] = useState('')
  const [addMinterAddress, setAddMinterAddress] = useState('')

  const isCreator =
    creator != null &&
    userAddress != null &&
    String(creator).toLowerCase() === String(userAddress).toLowerCase()

  const handleMint = () => {
    if (!poapAddress || !mintTo.trim() || !mintMetadataURI.trim()) return
    const to = mintTo.trim() as `0x${string}`
    if (!to.startsWith('0x') || to.length !== 42) return
    writeMutate({
      address: poapAddress,
      abi: activityPOAPAbi,
      functionName: 'mint',
      args: [to, mintMetadataURI.trim()],
    })
  }

  const handleAddMinter = () => {
    if (!poapAddress || !addMinterAddress.trim()) return
    const addr = addMinterAddress.trim() as `0x${string}`
    if (!addr.startsWith('0x') || addr.length !== 42) return
    writeMutate({
      address: poapAddress,
      abi: activityPOAPAbi,
      functionName: 'addMinter',
      args: [addr],
    })
  }

  if (!poapAddress) {
    return (
      <div className="min-h-svh flex flex-col items-center justify-center gap-6 p-6">
        <header className="flex justify-between w-full max-w-4xl">
          <Link to="/dev" className="text-2xl font-semibold hover:opacity-80">
            Eventacle DAO · Dev
          </Link>
          <ConnectButton showBalance={false} />
        </header>
        <main className="text-center text-muted-foreground">
          <p>无效的 POAP 合约地址</p>
          <Link to="/dev" className="text-primary underline mt-2 inline-block">
            返回开发页
          </Link>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-svh flex flex-col items-center gap-6 p-6">
      <header className="flex items-center justify-between w-full max-w-4xl">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-2xl font-semibold hover:opacity-80">
            Eventacle DAO
          </Link>
          <Link to="/dev" className="text-sm text-muted-foreground hover:text-foreground">
            开发 / Dev
          </Link>
        </div>
        <ConnectButton showBalance={false} />
      </header>

      <main className="flex flex-col items-center gap-6 w-full max-w-4xl">
        {!isTestnet && (
          <p className="text-sm text-amber-600">
            请切换到 Injective Testnet 以操作此合约
          </p>
        )}

        <section className="rounded-lg border bg-card p-4 w-full">
          <h2 className="text-lg font-medium mb-3">POAP 合约信息</h2>
          <dl className="grid gap-2 text-sm">
            <div>
              <dt className="text-muted-foreground">合约地址</dt>
              <dd className="font-mono break-all">{poapAddress}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">名称</dt>
              <dd>{poapName != null ? String(poapName) : '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Symbol</dt>
              <dd>{poapSymbol != null ? String(poapSymbol) : '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">已铸造数量 (totalSupply)</dt>
              <dd className="tabular-nums">
                {totalSupply != null ? String(totalSupply) : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">创建者 (creator)</dt>
              <dd className="font-mono break-all">
                {creator != null ? String(creator) : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Contract URI</dt>
              <dd className="break-all text-xs">
                {contractURI != null ? String(contractURI) : '—'}
              </dd>
            </div>
            {isConnected && (
              <div>
                <dt className="text-muted-foreground">我的持有数量</dt>
                <dd className="tabular-nums">
                  {myBalance != null ? String(myBalance) : '—'}
                </dd>
              </div>
            )}
            {isConnected && (
              <div>
                <dt className="text-muted-foreground">是否具有铸造权限 (minter)</dt>
                <dd>{isMinter === true ? '是' : '否'}</dd>
              </div>
            )}
          </dl>
        </section>

        <section className="rounded-lg border bg-card p-4 w-full">
          <h2 className="text-lg font-medium mb-3">已铸造的 POAP</h2>
          {totalSupply != null && Number(totalSupply) > 0 ? (
            <>
              <p className="text-sm text-muted-foreground mb-3">
                共 {String(totalSupply)} 枚
                {Number(totalSupply) > 100 ? '，仅展示前 100 枚' : ''}。
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b border-border">
                      <th className="py-2 pr-4 font-medium">Token ID</th>
                      <th className="py-2 pr-4 font-medium">图像</th>
                      <th className="py-2 pr-4 font-medium">持有者 (owner)</th>
                      <th className="py-2 pr-4 font-medium">Token URI</th>
                      <th className="py-2 font-medium">铸造时间（北京时间）</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(
                      {
                        length: Math.min(Number(totalSupply), 100),
                      },
                      (_, i) => i + 1,
                    ).map((id) => (
                      <MintedTokenRow
                        key={id}
                        tokenId={id}
                        poapAddress={poapAddress}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">暂无已铸造的 POAP</p>
          )}
        </section>

        {isConnected && isMinter === true && isTestnet && (
          <section className="rounded-lg border bg-card p-4 w-full">
            <h2 className="text-lg font-medium mb-3">铸造 POAP (mint)</h2>
            <p className="text-sm text-muted-foreground mb-3">
              仅 minter 可调用。填写接收地址与该枚 POAP 的元数据 URI（如 IPFS）。
            </p>
            <div className="flex flex-col gap-3 max-w-sm">
              <input
                className="rounded border px-3 py-2 text-sm font-mono"
                placeholder="接收地址 (0x...)"
                value={mintTo}
                onChange={(e) => setMintTo(e.target.value)}
              />
              <input
                className="rounded border px-3 py-2 text-sm"
                placeholder="Token 元数据 URI (如 ipfs://...)"
                value={mintMetadataURI}
                onChange={(e) => setMintMetadataURI(e.target.value)}
              />
              <button
                type="button"
                className="rounded bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
                disabled={
                  !mintTo.trim() ||
                  !mintMetadataURI.trim() ||
                  mintTo.trim().length !== 42 ||
                  !mintTo.trim().startsWith('0x') ||
                  isWritePending
                }
                onClick={handleMint}
              >
                {isWritePending ? '提交中…' : '铸造'}
              </button>
              {writeError && (
                <p className="text-sm text-destructive">{writeError.message}</p>
              )}
              {writeHash && (
                <p className="text-sm text-muted-foreground">交易: {writeHash}</p>
              )}
            </div>
          </section>
        )}

        {isConnected && isCreator && isTestnet && (
          <section className="rounded-lg border bg-card p-4 w-full">
            <h2 className="text-lg font-medium mb-3">添加 Minter</h2>
            <p className="text-sm text-muted-foreground mb-3">
              仅合约创建者 (creator) 可调用。添加后该地址将具有铸造权限。
            </p>
            <div className="flex flex-col gap-3 max-w-sm">
              <input
                className="rounded border px-3 py-2 text-sm font-mono"
                placeholder="Minter 地址 (0x...)"
                value={addMinterAddress}
                onChange={(e) => setAddMinterAddress(e.target.value)}
              />
              <button
                type="button"
                className="rounded bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
                disabled={
                  !addMinterAddress.trim() ||
                  addMinterAddress.trim().length !== 42 ||
                  !addMinterAddress.trim().startsWith('0x') ||
                  isWritePending
                }
                onClick={handleAddMinter}
              >
                {isWritePending ? '提交中…' : '添加 Minter'}
              </button>
              {writeError && (
                <p className="text-sm text-destructive">{writeError.message}</p>
              )}
              {writeHash && (
                <p className="text-sm text-muted-foreground">交易: {writeHash}</p>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
