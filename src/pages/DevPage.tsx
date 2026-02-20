import { useEffect, useState } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Link } from 'react-router-dom'
import {
  useAccount,
  useBalance,
  useChainId,
  useReadContract,
  useWriteContract,
} from 'wagmi'
import { activityFactoryAbi, reviewStakingAbi } from '../abis'
import {
  getDeploymentAddresses,
  INJECTIVE_TESTNET_CHAIN_ID,
} from '../config/contracts'
import { pinata } from '../config/pinata'

const TIMEZONE = 'Asia/Shanghai'

function formatUnixToLocal(unixSeconds: bigint | number): string {
  const date = new Date(Number(unixSeconds) * 1000)
  return date.toLocaleString('zh-CN', {
    timeZone: TIMEZONE,
    dateStyle: 'long',
    timeStyle: 'short',
    hour12: false,
  })
}

export function DevPage() {
  const chainId = useChainId()
  const { address, isConnected } = useAccount()
  const { data: balance, isLoading: isBalanceLoading } = useBalance({
    address: address ?? undefined,
  })

  const addresses = getDeploymentAddresses(chainId)
  const factoryAddress = addresses?.factory
  const reviewStakingAddress = addresses?.reviewStaking

  const { data: activityIds = [], isLoading: isLoadingIds } = useReadContract({
    address: factoryAddress ?? undefined,
    abi: activityFactoryAbi,
    functionName: 'getAllActivityIds',
  })

  const { data: ongoingData, isLoading: isLoadingOngoing } = useReadContract({
    address: factoryAddress ?? undefined,
    abi: activityFactoryAbi,
    functionName: 'getOngoingActivityIdsPaginated',
    args: [0n, 50n],
  })
  const ongoingIds: string[] = Array.isArray(ongoingData)
    ? (ongoingData[0] ?? [])
    : typeof ongoingData === 'object' && ongoingData !== null && 'ids' in ongoingData
      ? (ongoingData as { ids: string[] }).ids ?? []
      : []
  const needUpdateOffset =
    Array.isArray(ongoingData) && ongoingData[3] === true
      ? true
      : typeof ongoingData === 'object' &&
          ongoingData !== null &&
          'needUpdateOffset' in ongoingData
        ? Boolean((ongoingData as { needUpdateOffset: boolean }).needUpdateOffset)
        : false

  const {
    mutate: scanUpdateMutate,
    isPending: isScanUpdatePending,
    isSuccess: isScanUpdateSuccess,
    error: scanUpdateError,
  } = useWriteContract()

  const [showNeedUpdateModal, setShowNeedUpdateModal] = useState(false)
  useEffect(() => {
    if (needUpdateOffset) setShowNeedUpdateModal(true)
  }, [needUpdateOffset])
  useEffect(() => {
    if (isScanUpdateSuccess) setShowNeedUpdateModal(false)
  }, [isScanUpdateSuccess])

  const handleScanUpdate = () => {
    if (!factoryAddress) return
    scanUpdateMutate({
      address: factoryAddress,
      abi: activityFactoryAbi,
      functionName: 'scanAndUpdateOngoingOffsetIfNeeded',
    })
  }

  const {
    mutate: writeContractMutate,
    isPending: isCreatePending,
    error: createError,
    data: createTxHash,
  } = useWriteContract()

  const [createName, setCreateName] = useState('')
  const [createSymbol, setCreateSymbol] = useState('')
  const [createVenue, setCreateVenue] = useState('')
  const [createStartAt, setCreateStartAt] = useState('')
  const [createEndAt, setCreateEndAt] = useState('')
  const [createActivityType, setCreateActivityType] = useState<0 | 1 | 2 | 3>(0)
  const [isUploadingMetadata, setIsUploadingMetadata] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null)

  const isTestnet = chainId === INJECTIVE_TESTNET_CHAIN_ID

  const { data: detailCreator } = useReadContract({
    address: factoryAddress ?? undefined,
    abi: activityFactoryAbi,
    functionName: 'getActivityCreator',
    args: selectedActivityId != null ? [selectedActivityId] : undefined,
  })
  const { data: detailCreatedAt } = useReadContract({
    address: factoryAddress ?? undefined,
    abi: activityFactoryAbi,
    functionName: 'getActivityCreatedAt',
    args: selectedActivityId != null ? [selectedActivityId] : undefined,
  })
  const { data: detailStartAt } = useReadContract({
    address: factoryAddress ?? undefined,
    abi: activityFactoryAbi,
    functionName: 'getActivityStartAt',
    args: selectedActivityId != null ? [selectedActivityId] : undefined,
  })
  const { data: detailEndAt } = useReadContract({
    address: factoryAddress ?? undefined,
    abi: activityFactoryAbi,
    functionName: 'getActivityEndAt',
    args: selectedActivityId != null ? [selectedActivityId] : undefined,
  })
  const { data: detailActivityType } = useReadContract({
    address: factoryAddress ?? undefined,
    abi: activityFactoryAbi,
    functionName: 'getActivityType',
    args: selectedActivityId != null ? [selectedActivityId] : undefined,
  })
  const { data: detailPOAP } = useReadContract({
    address: factoryAddress ?? undefined,
    abi: activityFactoryAbi,
    functionName: 'getPOAPContract',
    args: selectedActivityId != null ? [selectedActivityId] : undefined,
  })
  const { data: detailMetadataUri } = useReadContract({
    address: factoryAddress ?? undefined,
    abi: activityFactoryAbi,
    functionName: 'getActivityMetadataURI',
    args: selectedActivityId != null ? [selectedActivityId] : undefined,
  })

  const [detailMetadata, setDetailMetadata] = useState<Record<string, unknown> | null>(null)
  const [detailMetadataLoading, setDetailMetadataLoading] = useState(false)
  const [detailMetadataError, setDetailMetadataError] = useState<string | null>(null)

  useEffect(() => {
    if (!detailMetadataUri || typeof detailMetadataUri !== 'string') {
      setDetailMetadata(null)
      setDetailMetadataError(null)
      setDetailMetadataLoading(false)
      return
    }
    const uri = detailMetadataUri.trim()
    if (!uri) {
      setDetailMetadata(null)
      return
    }
    let cancelled = false
    setDetailMetadata(null)
    setDetailMetadataLoading(true)
    setDetailMetadataError(null)
    const gatewayBase =
      typeof import.meta.env.VITE_PINATA_GATEWAY === 'string' &&
      import.meta.env.VITE_PINATA_GATEWAY.trim()
        ? import.meta.env.VITE_PINATA_GATEWAY.trim().replace(/\/$/, '')
        : 'https://gateway.pinata.cloud'
    const gatewayUrl = uri.startsWith('ipfs://')
      ? `${gatewayBase}/ipfs/${uri.slice(7)}`
      : uri
    fetch(gatewayUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => {
        if (!cancelled) {
          setDetailMetadata(data as Record<string, unknown>)
          setDetailMetadataError(null)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setDetailMetadata(null)
          setDetailMetadataError(e instanceof Error ? e.message : '加载元数据失败')
        }
      })
      .finally(() => {
        if (!cancelled) setDetailMetadataLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [detailMetadataUri])

  const { data: requiredStake } = useReadContract({
    address: reviewStakingAddress ?? undefined,
    abi: reviewStakingAbi,
    functionName: 'requiredStake',
  })
  const { data: totalStaked } = useReadContract({
    address: reviewStakingAddress ?? undefined,
    abi: reviewStakingAbi,
    functionName: 'totalStaked',
  })
  const { data: myStakedAmount } = useReadContract({
    address: reviewStakingAddress ?? undefined,
    abi: reviewStakingAbi,
    functionName: 'stakedAmount',
    args: address != null ? [address] : undefined,
  })
  const { data: hasReviewPermission } = useReadContract({
    address: reviewStakingAddress ?? undefined,
    abi: reviewStakingAbi,
    functionName: 'hasReviewPermission',
    args: address != null ? [address] : undefined,
  })

  const {
    mutate: writeStakingMutate,
    isPending: isStakingPending,
    error: stakingError,
    data: stakingTxHash,
  } = useWriteContract()

  const [stakeAmount, setStakeAmount] = useState('')
  const [unstakeAmount, setUnstakeAmount] = useState('')

  const decimals = 18
  const handleStake = () => {
    if (!reviewStakingAddress || !stakeAmount || Number(stakeAmount) <= 0) return
    const valueWei = BigInt(Math.floor(Number(stakeAmount) * 10 ** decimals))
    writeStakingMutate({
      address: reviewStakingAddress,
      abi: reviewStakingAbi,
      functionName: 'stake',
      value: valueWei,
    })
  }
  const handleUnstake = () => {
    if (!reviewStakingAddress || !unstakeAmount || Number(unstakeAmount) <= 0) return
    const amountWei = BigInt(Math.floor(Number(unstakeAmount) * 10 ** decimals))
    writeStakingMutate({
      address: reviewStakingAddress,
      abi: reviewStakingAbi,
      functionName: 'unstake',
      args: [amountWei],
    })
  }

  const handleCreateActivity = async () => {
    const name = createName.trim()
    const symbol = createSymbol.trim()
    const venue = createVenue.trim()
    const startAtStr = createStartAt.trim()
    const endAtStr = createEndAt.trim()
    if (!factoryAddress || !name || !symbol || !venue || !startAtStr || !endAtStr) return
    const startAt = Math.floor(new Date(startAtStr).getTime() / 1000)
    const endAt = Math.floor(new Date(endAtStr).getTime() / 1000)
    if (Number.isNaN(startAt) || Number.isNaN(endAt)) {
      setUploadError('请填写有效的开始/结束时间')
      return
    }
    if (endAt <= startAt) {
      setUploadError('结束时间必须晚于开始时间')
      return
    }
    setUploadError(null)
    if (!pinata) {
      setUploadError('请先在 .env 中配置 VITE_PINATA_JWT')
      return
    }
    setIsUploadingMetadata(true)
    try {
      const metadata = {
        name,
        symbol,
        location: venue,
        eventStartTime: startAtStr,
        eventEndTime: endAtStr,
      }
      const result = await pinata.upload.public.json(metadata)
      const metadataUri = `ipfs://${result.cid}`
      writeContractMutate({
        address: factoryAddress,
        abi: activityFactoryAbi,
        functionName: 'createActivity',
        args: [name, symbol, metadataUri, BigInt(startAt), BigInt(endAt), createActivityType],
      })
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : '上传元数据失败')
    } finally {
      setIsUploadingMetadata(false)
    }
  }

  return (
    <div className="min-h-svh flex flex-col items-center justify-center gap-6 p-6">
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
        {isConnected && (
          <div className="rounded-lg border bg-card px-4 py-3 text-card-foreground w-full">
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

        {isConnected && !isTestnet && (
          <p className="text-sm text-amber-600">
            请切换到 Injective Testnet 以使用活动合约
          </p>
        )}

        {isConnected && isTestnet && factoryAddress && (
          <>
            {showNeedUpdateModal && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
                aria-modal="true"
                role="dialog"
              >
                <div className="rounded-lg border bg-card p-5 w-full max-w-md shadow-lg space-y-4">
                  <h3 className="text-lg font-semibold">需要更新「进行中活动」索引</h3>
                  <p className="text-sm text-muted-foreground">
                    合约检测到进行中活动的索引需要更新。更新后可以：
                  </p>
                  <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                    <li>加快以后访问「当前正在进行的活动」列表的速度</li>
                    <li>保持列表与链上状态一致、更准确</li>
                    <li>减少后续查询的 gas 消耗</li>
                  </ul>
                  {scanUpdateError && (
                    <p className="text-sm text-destructive">{scanUpdateError.message}</p>
                  )}
                  <div className="flex gap-3 justify-end">
                    <button
                      type="button"
                      className="rounded border border-input px-4 py-2 text-sm font-medium hover:bg-muted/80"
                      onClick={() => setShowNeedUpdateModal(false)}
                      disabled={isScanUpdatePending}
                    >
                      稍后
                    </button>
                    <button
                      type="button"
                      className="rounded bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
                      onClick={handleScanUpdate}
                      disabled={isScanUpdatePending}
                    >
                      {isScanUpdatePending ? '提交中…' : '立即更新'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <section className="rounded-lg border bg-card p-4 w-full">
              <h2 className="text-lg font-medium mb-3">当前正在进行的活动</h2>
              {isLoadingOngoing ? (
                <p className="text-sm text-muted-foreground">加载中…</p>
              ) : ongoingIds.length > 0 ? (
                <ul className="space-y-1 text-sm">
                  {ongoingIds.map((id: string) => (
                    <li key={id}>
                      <button
                        type="button"
                        className="w-full text-left rounded px-3 py-2 hover:bg-muted/60 transition-colors truncate bg-primary/10 border border-primary/20"
                        onClick={() => setSelectedActivityId(id)}
                      >
                        {id}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">当前没有正在进行的活动</p>
              )}
            </section>

            <section className="rounded-lg border bg-card p-4 w-full">
              <h2 className="text-lg font-medium mb-3">活动列表（链上读取）</h2>
              {isLoadingIds ? (
                <p className="text-sm text-muted-foreground">加载中…</p>
              ) : Array.isArray(activityIds) && activityIds.length > 0 ? (
                <ul className="space-y-1 text-sm">
                  {activityIds.map((id: string) => (
                    <li key={id}>
                      <button
                        type="button"
                        className="w-full text-left rounded px-3 py-2 hover:bg-muted/60 transition-colors truncate"
                        onClick={() => setSelectedActivityId(id)}
                      >
                        {id}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">暂无活动</p>
              )}

              {selectedActivityId != null && (
                <div className="mt-4 rounded-lg border bg-muted/30 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">活动详情</h3>
                    <button
                      type="button"
                      className="text-sm text-muted-foreground hover:text-foreground"
                      onClick={() => setSelectedActivityId(null)}
                    >
                      关闭
                    </button>
                  </div>
                  <dl className="grid gap-2 text-sm">
                    <div>
                      <dt className="text-muted-foreground">活动 ID</dt>
                      <dd className="font-mono break-all">{selectedActivityId}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">创建者</dt>
                      <dd className="font-mono break-all">
                        {detailCreator != null ? String(detailCreator) : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">创建时间（北京时间）</dt>
                      <dd>
                        {detailCreatedAt != null
                          ? formatUnixToLocal(Number(detailCreatedAt))
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">POAP 合约地址</dt>
                      <dd className="font-mono break-all">
                        {detailPOAP != null ? (
                          <Link
                            to={`/dev/poap/${encodeURIComponent(String(detailPOAP))}`}
                            className="text-primary underline hover:no-underline"
                          >
                            {String(detailPOAP)}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">元数据 URI</dt>
                      <dd className="font-mono break-all text-xs">
                        {detailMetadataUri != null && typeof detailMetadataUri === 'string'
                          ? detailMetadataUri
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">开始时间（北京时间）</dt>
                      <dd>
                        {detailStartAt != null
                          ? formatUnixToLocal(Number(detailStartAt))
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">结束时间（北京时间）</dt>
                      <dd>
                        {detailEndAt != null
                          ? formatUnixToLocal(Number(detailEndAt))
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">活动类型</dt>
                      <dd>
                        {detailActivityType != null
                          ? String(detailActivityType)
                          : '—'}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-3 pt-3 border-t">
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">
                      元数据内容（IPFS）
                    </h4>
                    {detailMetadataLoading ? (
                      <p className="text-sm text-muted-foreground">加载中…</p>
                    ) : detailMetadataError ? (
                      <p className="text-sm text-destructive">{detailMetadataError}</p>
                    ) : detailMetadata ? (
                      <dl className="grid gap-2 text-sm">
                        {Object.entries(detailMetadata).map(([key, value]) => (
                          <div key={key}>
                            <dt className="text-muted-foreground capitalize">
                              {key.replace(/([A-Z])/g, ' $1').trim()}
                            </dt>
                            <dd className="break-words">
                              {typeof value === 'object' && value !== null
                                ? JSON.stringify(value)
                                : String(value)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    ) : (
                      <p className="text-sm text-muted-foreground">暂无元数据</p>
                    )}
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-lg border bg-card p-4 w-full">
              <h2 className="text-lg font-medium mb-3">创建活动（需钱包签名）</h2>
              <p className="text-sm text-muted-foreground mb-3">
                名称、Symbol、举办地点、开始/结束时间将上传至 IPFS；链上写入元数据 URI、startAt、endAt 与活动类型。
              </p>
              <div className="flex flex-col gap-3 max-w-sm">
                <input
                  className="rounded border px-3 py-2 text-sm"
                  placeholder="活动名称 *"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                />
                <input
                  className="rounded border px-3 py-2 text-sm"
                  placeholder="Symbol *"
                  value={createSymbol}
                  onChange={(e) => setCreateSymbol(e.target.value)}
                />
                <input
                  className="rounded border px-3 py-2 text-sm"
                  placeholder="活动举办地点 *"
                  value={createVenue}
                  onChange={(e) => setCreateVenue(e.target.value)}
                />
                <div>
                  <label className="text-sm text-muted-foreground">活动开始时间 *</label>
                  <input
                    type="datetime-local"
                    className="w-full rounded border px-3 py-2 text-sm mt-1"
                    value={createStartAt}
                    onChange={(e) => setCreateStartAt(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">活动结束时间 *</label>
                  <input
                    type="datetime-local"
                    className="w-full rounded border px-3 py-2 text-sm mt-1"
                    value={createEndAt}
                    onChange={(e) => setCreateEndAt(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">活动类型</label>
                  <select
                    className="w-full rounded border px-3 py-2 text-sm mt-1 bg-background"
                    value={createActivityType}
                    onChange={(e) =>
                      setCreateActivityType(Number(e.target.value) as 0 | 1 | 2 | 3)
                    }
                  >
                    <option value={0}>线下聚会 (MEETUP)</option>
                    <option value={1}>黑客松 (HACKATHON)</option>
                    <option value={2}>会议 (CONFERENCE)</option>
                    <option value={3}>其他 (OTHER)</option>
                  </select>
                </div>
                <button
                  type="button"
                  className="rounded bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
                  disabled={
                    !createName.trim() ||
                    !createSymbol.trim() ||
                    !createVenue.trim() ||
                    !createStartAt.trim() ||
                    !createEndAt.trim() ||
                    isUploadingMetadata ||
                    isCreatePending
                  }
                  onClick={handleCreateActivity}
                >
                  {isUploadingMetadata
                    ? '上传元数据…'
                    : isCreatePending
                      ? '提交交易…'
                      : '创建活动'}
                </button>
                {uploadError && (
                  <p className="text-sm text-destructive">{uploadError}</p>
                )}
                {createError && (
                  <p className="text-sm text-destructive">
                    {createError.message}
                  </p>
                )}
                {createTxHash && (
                  <p className="text-sm text-muted-foreground">
                    交易已提交: {createTxHash}
                  </p>
                )}
              </div>
            </section>

            {reviewStakingAddress && (
              <section className="rounded-lg border bg-card p-4 w-full">
                <h2 className="text-lg font-medium mb-3">审核质押（Review Staking）</h2>
                <p className="text-sm text-muted-foreground mb-3">
                  质押 INJ 达到门槛后可获得审核权限；取回时需先解除质押。
                </p>
                <dl className="grid gap-2 text-sm mb-4">
                  <div>
                    <dt className="text-muted-foreground">当前门槛（requiredStake）</dt>
                    <dd className="tabular-nums">
                      {requiredStake != null
                        ? `${(Number(requiredStake) / 10 ** decimals).toFixed(6)} INJ`
                        : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">全网已质押（totalStaked）</dt>
                    <dd className="tabular-nums">
                      {totalStaked != null
                        ? `${(Number(totalStaked) / 10 ** decimals).toFixed(6)} INJ`
                        : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">我的质押额</dt>
                    <dd className="tabular-nums">
                      {myStakedAmount != null
                        ? `${(Number(myStakedAmount) / 10 ** decimals).toFixed(6)} INJ`
                        : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">是否具备审核权限</dt>
                    <dd>{hasReviewPermission === true ? '是' : '否'}</dd>
                  </div>
                </dl>
                <div className="flex flex-col gap-3 max-w-sm">
                  <div>
                    <label className="text-sm text-muted-foreground">质押数量（INJ）</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="w-full rounded border px-3 py-2 text-sm mt-1"
                      placeholder="0"
                      value={stakeAmount}
                      onChange={(e) => setStakeAmount(e.target.value)}
                    />
                    <button
                      type="button"
                      className="mt-2 rounded bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
                      disabled={!stakeAmount || Number(stakeAmount) <= 0 || isStakingPending}
                      onClick={handleStake}
                    >
                      {isStakingPending ? '提交中…' : '质押'}
                    </button>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">取回数量（INJ）</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="w-full rounded border px-3 py-2 text-sm mt-1"
                      placeholder="0"
                      value={unstakeAmount}
                      onChange={(e) => setUnstakeAmount(e.target.value)}
                    />
                    <button
                      type="button"
                      className="mt-2 rounded border border-input px-4 py-2 text-sm font-medium disabled:opacity-50"
                      disabled={!unstakeAmount || Number(unstakeAmount) <= 0 || isStakingPending}
                      onClick={handleUnstake}
                    >
                      {isStakingPending ? '提交中…' : '取回'}
                    </button>
                  </div>
                </div>
                {stakingError && (
                  <p className="text-sm text-destructive mt-2">{stakingError.message}</p>
                )}
                {stakingTxHash && (
                  <p className="text-sm text-muted-foreground mt-2">
                    交易已提交: {stakingTxHash}
                  </p>
                )}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}
