import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { LOCAL_SHARE_SAVE_PATHS } from '../src/app/share/services/share-artifacts.ts'
import {
  syncShareRuntimeArtifactsToLedger,
  verifyShareLedgerAgainstRuntime,
  type ShareRuntimeArtifactsText
} from '../src/lib/content-db/share-migration-contracts.ts'

type VerifyArgs = {
  baseDir: string
}

type VerifyFailureCode =
  | 'ARGUMENT_INVALID'
  | 'ARTIFACT_MISSING'
  | 'ARTIFACT_INVALID_JSON'
  | 'ARTIFACT_INVALID_SHAPE'
  | 'RUNTIME_FAILURE'

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

class VerifyArgumentError extends Error {
  readonly failureCode = 'ARGUMENT_INVALID' as const

  constructor(message: string) {
    super(message)
    this.name = 'VerifyArgumentError'
  }
}

class ShareArtifactError extends Error {
  constructor(
    readonly failureCode: Exclude<VerifyFailureCode, 'ARGUMENT_INVALID' | 'RUNTIME_FAILURE'>,
    readonly artifactPath: string,
    message: string
  ) {
    super(message)
    this.name = 'ShareArtifactError'
  }
}

function parseArgs(argv: string[]): VerifyArgs {
  let baseDir: string | undefined

  for (let index = 0; index < argv.length; index += 1) {
    const entry = argv[index]

    if (entry.startsWith('--base-dir=')) {
      const value = entry.slice('--base-dir='.length)
      if (!value) {
        throw new VerifyArgumentError('--base-dir 需要提供路径值')
      }
      baseDir = value
      continue
    }

    if (entry === '--base-dir') {
      const value = argv[index + 1]
      if (!value || value.startsWith('--')) {
        throw new VerifyArgumentError('--base-dir 需要提供路径值')
      }
      baseDir = value
      index += 1
      continue
    }

    throw new VerifyArgumentError(`未知参数：${entry}`)
  }

  return {
    baseDir: baseDir ?? process.cwd()
  }
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

function readStrictShareArtifacts(baseDir: string): ShareRuntimeArtifactsText {
  return {
    list: readStrictArtifact(baseDir, LOCAL_SHARE_SAVE_PATHS.list),
    categories: readStrictArtifact(baseDir, LOCAL_SHARE_SAVE_PATHS.categories),
    folders: readStrictArtifact(baseDir, LOCAL_SHARE_SAVE_PATHS.folders),
    storage: readStrictArtifact(baseDir, LOCAL_SHARE_SAVE_PATHS.storage)
  }
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

function buildSummary(artifactsToRebuild: string[]): string {
  if (artifactsToRebuild.length === 0) {
    return '当前 share 正式产物与账本一致，无需重建。'
  }

  return `待重建 share 正式产物：${artifactsToRebuild.join('、')}`
}

function runVerification(baseDir: string): VerifySuccessSummary {
  const runtimeArtifacts = readStrictShareArtifacts(baseDir)

  try {
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
  } catch (error) {
    throw createArtifactShapeError(error) ?? error
  }
}

function buildFailureSummary(error: unknown): VerifyFailureSummary {
  if (error instanceof VerifyArgumentError) {
    return {
      ok: false,
      operation: 'verify',
      code: error.failureCode,
      message: error.message
    }
  }

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

function writeJsonToStdout(value: VerifySuccessSummary | VerifyFailureSummary) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
}

function writeHumanErrorToStderr(message: string) {
  process.stderr.write(`${message}\n`)
}

async function main(): Promise<void> {
  try {
    const args = parseArgs(process.argv.slice(2))
    const summary = runVerification(args.baseDir)
    writeJsonToStdout(summary)
    process.exitCode = summary.artifactsToRebuild.length > 0 ? 1 : 0
  } catch (error) {
    const failure = buildFailureSummary(error)
    writeJsonToStdout(failure)
    writeHumanErrorToStderr(failure.message)
    process.exitCode = 2
  }
}

void main()
