import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { LOCAL_SHARE_SAVE_PATHS } from '../src/app/share/services/share-artifacts.ts'
import {
  syncShareRuntimeArtifactsToLedger,
  verifyShareLedgerAgainstRuntime,
  type ShareRuntimeArtifactsText
} from '../src/lib/content-db/share-migration-contracts.ts'

type VerifyArgs = {
  baseDir?: string
}

type VerifyFailureCode = 'ARTIFACT_MISSING' | 'ARTIFACT_INVALID_JSON' | 'ARTIFACT_INVALID_SHAPE' | 'RUNTIME_FAILURE'

type VerifySuccessSummary = {
  ok: true
  operation: 'verify'
  summary: string
  artifactsToRebuild: string[]
  ledger: {
    shareEntriesCount: number
  }
  verify: {
    artifactsToRebuild: string[]
    touchesMarkdown: boolean
    touchesImages: boolean
    atomic: boolean
  }
}

type VerifyFailureSummary = {
  ok: false
  operation: 'verify'
  code: VerifyFailureCode
  message: string
  details?: unknown
}

class ShareArtifactError extends Error {
  constructor(
    readonly failureCode: Exclude<VerifyFailureCode, 'RUNTIME_FAILURE'>,
    readonly artifactPath: string,
    message: string
  ) {
    super(message)
    this.name = 'ShareArtifactError'
  }
}

function parseArgs(argv: string[]): VerifyArgs {
  const args: VerifyArgs = {}

  for (let index = 0; index < argv.length; index += 1) {
    const entry = argv[index]

    if (entry.startsWith('--base-dir=')) {
      args.baseDir = entry.slice('--base-dir='.length)
      continue
    }

    if (entry === '--base-dir') {
      args.baseDir = argv[index + 1]
      index += 1
    }
  }

  return args
}

function isNodeErrorWithCode(error: unknown, code: string): error is NodeJS.ErrnoException {
  return Boolean(error) && typeof error === 'object' && 'code' in error && error.code === code
}

function readStrictArtifact(baseDir: string, artifactPath: string): string {
  const filePath = resolve(baseDir, artifactPath)
  let raw: string

  try {
    raw = readFileSync(filePath, 'utf8')
  } catch (error) {
    if (isNodeErrorWithCode(error, 'ENOENT')) {
      throw new ShareArtifactError('ARTIFACT_MISSING', artifactPath, `缺少 share 正式产物：${artifactPath}`)
    }
    throw error
  }

  try {
    JSON.parse(raw)
  } catch {
    throw new ShareArtifactError('ARTIFACT_INVALID_JSON', artifactPath, `${artifactPath} 不是合法 JSON`)
  }

  return raw
}

function mapContractErrorToArtifactPath(message: string): string | null {
  if (message.startsWith('runtimeArtifacts.list') || message.startsWith('list')) {
    return LOCAL_SHARE_SAVE_PATHS.list
  }
  if (message.startsWith('runtimeArtifacts.categories')) {
    return LOCAL_SHARE_SAVE_PATHS.categories
  }
  if (message.startsWith('runtimeArtifacts.folders')) {
    return LOCAL_SHARE_SAVE_PATHS.folders
  }
  if (message.startsWith('runtimeArtifacts.storage') || message.startsWith('storage')) {
    return LOCAL_SHARE_SAVE_PATHS.storage
  }
  return null
}

function createArtifactShapeError(error: unknown): ShareArtifactError | null {
  const message = error instanceof Error ? error.message : String(error)
  const artifactPath = mapContractErrorToArtifactPath(message)

  if (!artifactPath) {
    return null
  }

  const failureCode = message.includes('非法 JSON') ? 'ARTIFACT_INVALID_JSON' : 'ARTIFACT_INVALID_SHAPE'
  const failureMessage =
    failureCode === 'ARTIFACT_INVALID_JSON' ? `${artifactPath} 不是合法 JSON` : `${artifactPath} 的内容结构不合法`

  return new ShareArtifactError(failureCode, artifactPath, failureMessage)
}

function readStrictShareArtifacts(baseDir: string): ShareRuntimeArtifactsText {
  const runtimeArtifacts = {
    list: readStrictArtifact(baseDir, LOCAL_SHARE_SAVE_PATHS.list),
    categories: readStrictArtifact(baseDir, LOCAL_SHARE_SAVE_PATHS.categories),
    folders: readStrictArtifact(baseDir, LOCAL_SHARE_SAVE_PATHS.folders),
    storage: readStrictArtifact(baseDir, LOCAL_SHARE_SAVE_PATHS.storage)
  }

  try {
    const synced = syncShareRuntimeArtifactsToLedger({
      list: runtimeArtifacts.list,
      storage: runtimeArtifacts.storage
    })

    verifyShareLedgerAgainstRuntime({
      storage: synced.storage,
      runtimeArtifacts
    })
  } catch (error) {
    const artifactError = createArtifactShapeError(error)
    if (artifactError) {
      throw artifactError
    }
    throw error
  }

  return runtimeArtifacts
}

function buildSummary(artifactsToRebuild: string[]): string {
  if (artifactsToRebuild.length === 0) {
    return '当前 share 正式产物与账本一致，无需重建。'
  }

  return `待重建 share 正式产物：${artifactsToRebuild.join('、')}`
}

function buildFailureSummary(error: unknown): VerifyFailureSummary {
  if (error instanceof ShareArtifactError) {
    return {
      ok: false,
      operation: 'verify',
      code: error.failureCode,
      message: error.message,
      details: {
        artifact: error.artifactPath
      }
    }
  }

  const message = error instanceof Error ? error.message : String(error)
  return {
    ok: false,
    operation: 'verify',
    code: 'RUNTIME_FAILURE',
    message
  }
}

function buildSuccessSummary(baseDir: string): VerifySuccessSummary {
  const runtimeArtifacts = readStrictShareArtifacts(baseDir)
  const synced = syncShareRuntimeArtifactsToLedger({
    list: runtimeArtifacts.list,
    storage: runtimeArtifacts.storage
  })
  const verification = verifyShareLedgerAgainstRuntime({
    storage: synced.storage,
    runtimeArtifacts
  })

  return {
    ok: true,
    operation: 'verify',
    summary: buildSummary(verification.artifactsToRebuild),
    artifactsToRebuild: verification.artifactsToRebuild,
    ledger: {
      shareEntriesCount: Object.keys(synced.storage.shares).length
    },
    verify: {
      artifactsToRebuild: verification.artifactsToRebuild,
      touchesMarkdown: verification.touchesMarkdown,
      touchesImages: verification.touchesImages,
      atomic: verification.atomic
    }
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const baseDir = args.baseDir ?? process.cwd()

  try {
    const summary = buildSuccessSummary(baseDir)
    console.log(JSON.stringify(summary, null, 2))
    process.exitCode = summary.artifactsToRebuild.length > 0 ? 1 : 0
  } catch (error) {
    const failure = buildFailureSummary(error)
    console.log(JSON.stringify(failure, null, 2))
    console.error(failure.message)
    process.exitCode = 2
  }
}

void main()
