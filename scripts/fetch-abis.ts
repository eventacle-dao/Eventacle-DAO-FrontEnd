/**
 * 从合约仓库自动拉取 ABI 到 src/abis/
 *
 * 用法:
 *   bun run scripts/fetch-abis.ts [合约仓库路径]
 *   CONTRACTS_ARTIFACTS_PATH=/path/to/Eventacle-DAO-Contracts bun run scripts/fetch-abis.ts
 *
 * 合约仓库路径默认为: ../Eventacle-DAO/Eventacle-DAO-Contracts
 * 会在 artifacts/contracts、cache/test-artifacts/contracts、out 下递归查找 <ContractName>.json (Hardhat/Foundry)
 */

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT_ABIS = join(ROOT, 'src', 'abis')

const CONTRACT_NAMES = [
  'ActivityFactory',
  'ReviewStaking',
  'ActivityComments',
  'ActivityPOAP',
] as const

function findArtifactPath(repoRoot: string, contractName: string): string | null {
  const candidates = [
    join(repoRoot, 'artifacts', 'contracts', contractName + '.sol', contractName + '.json'),
    join(repoRoot, 'artifacts', 'contracts', contractName, contractName + '.json'),
    join(repoRoot, 'out', contractName + '.sol', contractName + '.json'),
  ]

  for (const p of candidates) {
    if (existsSync(p)) return p
  }

  // 递归在目录下找 <ContractName>.json
  const dirs = [
    join(repoRoot, 'artifacts', 'contracts'),
    join(repoRoot, 'cache', 'test-artifacts', 'contracts'),
    join(repoRoot, 'out'),
  ]
  const targetFile = contractName + '.json'
  for (const dir of dirs) {
    if (!existsSync(dir)) continue
    const found = walkForFile(dir, targetFile)
    if (found) return found
  }
  return null
}

function walkForFile(dir: string, fileName: string): string | null {
  const entries = readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = join(dir, e.name)
    if (e.isFile() && e.name === fileName) return full
    if (e.isDirectory()) {
      const sub = walkForFile(full, fileName)
      if (sub) return sub
    }
  }
  return null
}

function extractAbi(artifactPath: string): unknown[] {
  const raw = readFileSync(artifactPath, 'utf-8')
  const data = JSON.parse(raw) as { abi?: unknown[]; [k: string]: unknown }
  if (Array.isArray(data.abi)) return data.abi
  if (Array.isArray(data)) return data
  throw new Error('No ABI array in ' + artifactPath)
}

function main() {
  const repoPath =
    process.argv[2]?.trim() ||
    process.env.CONTRACTS_ARTIFACTS_PATH?.trim() ||
    join(ROOT, '..', 'Eventacle-dao/Eventacle-DAO-Contracts')

  if (!existsSync(repoPath)) {
    console.error('合约仓库路径不存在:', repoPath)
    console.error('用法: bun run scripts/fetch-abis.ts [路径]')
    console.error('或设置环境变量: CONTRACTS_ARTIFACTS_PATH=/path/to/contracts')
    process.exit(1)
  }

  console.log('合约仓库:', repoPath)
  console.log('输出目录:', OUT_ABIS)

  let ok = 0
  for (const name of CONTRACT_NAMES) {
    const artifactPath = findArtifactPath(repoPath, name)
    if (!artifactPath) {
      console.warn('未找到:', name)
      continue
    }
    const abi = extractAbi(artifactPath)
    const outPath = join(OUT_ABIS, name + '.json')
    writeFileSync(outPath, JSON.stringify(abi, null, 2), 'utf-8')
    console.log('已写入:', outPath)
    ok++
  }

  console.log('完成:', ok, '/', CONTRACT_NAMES.length)
  if (ok < CONTRACT_NAMES.length) {
    process.exit(1)
  }
}

main()
