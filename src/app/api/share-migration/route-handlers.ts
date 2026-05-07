import { createHash } from 'node:crypto'
import { readFile, rename, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { LOCAL_SHARE_SAVE_PATHS } from '../../share/services/share-artifacts.ts'
import {
  rebuildShareRuntimeArtifactsFromStorage,
  syncShareRuntimeArtifactsToLedger,
  verifyShareLedgerAgainstRuntime,
  type ShareRuntimeArtifactsText
} from '../../../lib/content-db/share-migration-contracts.ts'
import { buildShareMigrationFailureResponse } from './share-migration-api-contracts.ts'
import {
  buildShareMigrationExecuteRouteResponse,
  buildShareMigrationPreviewRouteResponse,
  enforceDevelopmentOnly
} from './share-migration-route-helper.ts'

type ShareArtifactFailureCode = 'ARTIFACT_MISSING' | 'ARTIFACT_INVALID_JSON' | 'ARTIFACT_INVALID_SHAPE'
type ReadText = (filePath: string) => Promise<string>
type WriteText = (filePath: string, content: string) => Promise<void>

type ShareArtifactSnapshot = {
  artifacts: ShareRuntimeArtifactsText
  snapshotHash: string
}

const PREVIEW_NOTICE = '只处理 share 正式产物，不会修改 logo 图片。预检查基于当前磁盘快照。'
const EXECUTE_NOTICE = '只处理 share 正式产物，不会修改 logo 图片。执行结果已基于写回后的磁盘状态复检。'

let shareMigrationExecuteLock: Promise<void> = Promise.resolve()

async function withShareMigrationExecuteLock<T>(operation: () => Promise<T>): Promise<T> {
  const previous = shareMigrationExecuteLock
  let release!: () => void
  shareMigrationExecuteLock = new Promise<void>(resolve => {
    release = resolve
  })

  await previous
  try {
    return await operation()
  } finally {
    release()
  }
}

class ShareArtifactError extends Error {
  readonly failureCode: ShareArtifactFailureCode
  readonly artifactPath: string

  constructor(failureCode: ShareArtifactFailureCode, artifactPath: string, message: string) {
    super(message)
    this.name = 'ShareArtifactError'
    this.failureCode = failureCode
    this.artifactPath = artifactPath
  }
}

class ShareArtifactWriteError extends Error {
  readonly artifactPath: string
  readonly rollbackFailedArtifacts: string[]

  constructor(artifactPath: string, cause: unknown, rollbackFailedArtifacts: string[] = []) {
    const details = cause instanceof Error ? cause.message : String(cause)
    super(`写入 share 正式产物失败：${artifactPath}${details ? ` (${details})` : ''}`)
    this.name = 'ShareArtifactWriteError'
    this.artifactPath = artifactPath
    this.rollbackFailedArtifacts = rollbackFailedArtifacts
  }
}

const defaultReadText: ReadText = filePath => readFile(filePath, 'utf8')

function buildAtomicShareArtifactTempPath(filePath: string) {
  return `${filePath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

const defaultWriteText: WriteText = async (filePath, content) => {
  const tempPath = buildAtomicShareArtifactTempPath(filePath)

  try {
    await writeFile(tempPath, content)
    await rename(tempPath, filePath)
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => undefined)
    throw error
  }
}

function isNodeErrorWithCode(error: unknown, code: string): error is NodeJS.ErrnoException {
  return Boolean(error) && typeof error === 'object' && 'code' in error && error.code === code
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

  const failureCode: ShareArtifactFailureCode = message.includes('非法 JSON') ? 'ARTIFACT_INVALID_JSON' : 'ARTIFACT_INVALID_SHAPE'
  const failureMessage =
    failureCode === 'ARTIFACT_INVALID_JSON' ? `${artifactPath} 不是合法 JSON` : `${artifactPath} 的内容结构不合法`

  return new ShareArtifactError(failureCode, artifactPath, failureMessage)
}

function buildArtifactFailureResponse(params: {
  operation: 'preview' | 'execute'
  error: ShareArtifactError
}) {
  return {
    status: 400,
    body: buildShareMigrationFailureResponse({
      operation: params.operation,
      code: params.error.failureCode,
      message: params.error.message,
      details: {
        artifact: params.error.artifactPath
      }
    })
  }
}

function buildWriteFailureResponse(params: {
  artifactPath: string
  writtenArtifactsPartial: string[]
  rollbackFailedArtifacts?: string[]
}) {
  return {
    status: 500,
    body: buildShareMigrationFailureResponse({
      operation: 'execute',
      code: 'WRITE_FAILED',
      message: `写入 share 正式产物失败：${params.artifactPath}`,
      writtenArtifactsPartial: params.writtenArtifactsPartial,
      shouldRepreview: true,
      details: {
        artifact: params.artifactPath,
        ...(params.rollbackFailedArtifacts && params.rollbackFailedArtifacts.length > 0 ? { rollbackFailedArtifacts: params.rollbackFailedArtifacts } : {})
      }
    })
  }
}

async function readStrictArtifact(params: {
  baseDir: string
  artifactPath: string
  readText: ReadText
}): Promise<string> {
  const filePath = resolve(params.baseDir, params.artifactPath)
  let raw: string

  try {
    raw = await params.readText(filePath)
  } catch (error) {
    if (isNodeErrorWithCode(error, 'ENOENT')) {
      throw new ShareArtifactError('ARTIFACT_MISSING', params.artifactPath, `缺少 share 正式产物：${params.artifactPath}`)
    }
    throw error
  }

  try {
    JSON.parse(raw)
  } catch {
    throw new ShareArtifactError('ARTIFACT_INVALID_JSON', params.artifactPath, `${params.artifactPath} 不是合法 JSON`)
  }

  return raw
}

function validateStrictArtifactShape(runtimeArtifacts: ShareRuntimeArtifactsText) {
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
}

async function readStrictShareArtifacts(params: {
  baseDir: string
  readText: ReadText
}): Promise<ShareRuntimeArtifactsText> {
  const list = await readStrictArtifact({
    baseDir: params.baseDir,
    artifactPath: LOCAL_SHARE_SAVE_PATHS.list,
    readText: params.readText
  })
  const categories = await readStrictArtifact({
    baseDir: params.baseDir,
    artifactPath: LOCAL_SHARE_SAVE_PATHS.categories,
    readText: params.readText
  })
  const folders = await readStrictArtifact({
    baseDir: params.baseDir,
    artifactPath: LOCAL_SHARE_SAVE_PATHS.folders,
    readText: params.readText
  })
  const storage = await readStrictArtifact({
    baseDir: params.baseDir,
    artifactPath: LOCAL_SHARE_SAVE_PATHS.storage,
    readText: params.readText
  })

  const runtimeArtifacts = {
    list,
    categories,
    folders,
    storage
  }

  validateStrictArtifactShape(runtimeArtifacts)

  return runtimeArtifacts
}

function createShareArtifactSnapshotHash(runtimeArtifacts: ShareRuntimeArtifactsText) {
  return createHash('sha256')
    .update(
      JSON.stringify([
        runtimeArtifacts.list,
        runtimeArtifacts.categories,
        runtimeArtifacts.folders,
        runtimeArtifacts.storage
      ])
    )
    .digest('hex')
}

async function readStrictShareArtifactSnapshot(params: {
  baseDir: string
  readText: ReadText
}): Promise<ShareArtifactSnapshot> {
  const artifacts = await readStrictShareArtifacts(params)

  return {
    artifacts,
    snapshotHash: createShareArtifactSnapshotHash(artifacts)
  }
}

function buildStalePreviewResponse(params: {
  expectedSnapshotHash: string | undefined
  actualSnapshotHash: string
}) {
  return {
    status: 409,
    body: buildShareMigrationFailureResponse({
      operation: 'execute',
      code: 'STALE_PREVIEW',
      message: '预检查快照已过期，请重新预检查后再执行',
      shouldRepreview: true,
      details: {
        expectedSnapshotHash: params.expectedSnapshotHash ?? null,
        actualSnapshotHash: params.actualSnapshotHash
      }
    })
  }
}

function buildPreviewSummary(artifactsToRebuild: string[]) {
  if (artifactsToRebuild.length === 0) {
    return '当前 share 正式产物与账本一致，无需重建。'
  }

  return `待重建 share 正式产物：${artifactsToRebuild.join('、')}`
}

function buildExecuteSummary() {
  return '已重建 share 正式产物。'
}

async function writeShareArtifactsInOrder(params: {
  baseDir: string
  artifacts: ShareRuntimeArtifactsText
  writtenArtifacts: string[]
  readText: ReadText
  writeText: WriteText
}) {
  const artifactEntries = [
    [LOCAL_SHARE_SAVE_PATHS.list, params.artifacts.list],
    [LOCAL_SHARE_SAVE_PATHS.categories, params.artifacts.categories],
    [LOCAL_SHARE_SAVE_PATHS.folders, params.artifacts.folders],
    [LOCAL_SHARE_SAVE_PATHS.storage, params.artifacts.storage]
  ] as const
  const writtenBackups: Array<{ artifactPath: string; filePath: string; content: string }> = []

  for (const [artifactPath, content] of artifactEntries) {
    const filePath = resolve(params.baseDir, artifactPath)
    let previousContent: string | undefined

    try {
      previousContent = await params.readText(filePath)
      await params.writeText(filePath, content)
      params.writtenArtifacts.push(artifactPath)
      writtenBackups.push({ artifactPath, filePath, content: previousContent })
    } catch (error) {
      const rollbackEntries = [...writtenBackups].reverse()
      if (previousContent !== undefined) {
        let currentArtifactChanged = true
        try {
          currentArtifactChanged = (await params.readText(filePath)) !== previousContent
        } catch {
          currentArtifactChanged = true
        }
        if (currentArtifactChanged) {
          rollbackEntries.unshift({ artifactPath, filePath, content: previousContent })
        }
      }

      const rollbackFailedArtifacts: string[] = []
      for (const backup of rollbackEntries) {
        let restoreError: unknown
        try {
          await params.writeText(backup.filePath, backup.content)
        } catch (error) {
          restoreError = error
        }

        if (restoreError) {
          try {
            if ((await params.readText(backup.filePath)) === backup.content) {
              continue
            }
          } catch {
            // Fall through and report the artifact as still dirty.
          }
          rollbackFailedArtifacts.push(backup.artifactPath)
        }
      }
      params.writtenArtifacts.length = 0
      params.writtenArtifacts.push(...rollbackFailedArtifacts)
      throw new ShareArtifactWriteError(artifactPath, error, rollbackFailedArtifacts)
    }
  }
}

export async function previewRoute(params: {
  nodeEnv: string | undefined
  baseDir?: string
  readText?: ReadText
}) {
  const access = enforceDevelopmentOnly({
    nodeEnv: params.nodeEnv,
    operation: 'preview'
  })
  if (!access.allowed) {
    return access
  }

  const baseDir = params.baseDir ?? process.cwd()
  const readText = params.readText ?? defaultReadText

  try {
    const runtimeSnapshot = await readStrictShareArtifactSnapshot({ baseDir, readText })
    const synced = syncShareRuntimeArtifactsToLedger({
      list: runtimeSnapshot.artifacts.list,
      storage: runtimeSnapshot.artifacts.storage
    })
    const verification = verifyShareLedgerAgainstRuntime({
      storage: synced.storage,
      runtimeArtifacts: runtimeSnapshot.artifacts
    })

    return buildShareMigrationPreviewRouteResponse({
      summary: buildPreviewSummary(verification.artifactsToRebuild),
      notice: PREVIEW_NOTICE,
      artifactsToRebuild: verification.artifactsToRebuild,
      snapshotHash: runtimeSnapshot.snapshotHash
    })
  } catch (error) {
    if (error instanceof ShareArtifactError) {
      return buildArtifactFailureResponse({ operation: 'preview', error })
    }

    const artifactError = createArtifactShapeError(error)
    if (artifactError) {
      return buildArtifactFailureResponse({ operation: 'preview', error: artifactError })
    }

    throw error
  }
}

export async function executeRoute(params: {
  nodeEnv: string | undefined
  confirmed: unknown
  snapshotHash?: string
  baseDir?: string
  readText?: ReadText
  writeText?: WriteText
}) {
  const access = enforceDevelopmentOnly({
    nodeEnv: params.nodeEnv,
    operation: 'execute'
  })
  if (!access.allowed) {
    return access
  }

  const confirmation = buildShareMigrationExecuteRouteResponse({
    confirmed: params.confirmed,
    summary: '',
    writtenArtifacts: [],
    artifactsToRebuildBeforeExecute: [],
    artifactsToRebuildAfterExecute: []
  })
  if (confirmation.status !== 200) {
    return confirmation
  }

  const baseDir = params.baseDir ?? process.cwd()
  const readText = params.readText ?? defaultReadText
  const writeText = params.writeText ?? defaultWriteText

  return withShareMigrationExecuteLock(async () => {
    try {
      const runtimeSnapshot = await readStrictShareArtifactSnapshot({ baseDir, readText })
      if (params.snapshotHash !== runtimeSnapshot.snapshotHash) {
        return buildStalePreviewResponse({
          expectedSnapshotHash: params.snapshotHash,
          actualSnapshotHash: runtimeSnapshot.snapshotHash
        })
      }

      const runtimeArtifacts = runtimeSnapshot.artifacts
      const synced = syncShareRuntimeArtifactsToLedger({
        list: runtimeArtifacts.list,
        storage: runtimeArtifacts.storage
      })
      const verificationBeforeExecute = verifyShareLedgerAgainstRuntime({
        storage: synced.storage,
        runtimeArtifacts
      })
      const rebuilt = rebuildShareRuntimeArtifactsFromStorage(synced.storage)
      const writtenArtifacts: string[] = []

      try {
        await writeShareArtifactsInOrder({
          baseDir,
          artifacts: rebuilt.artifacts,
          writtenArtifacts,
          readText,
          writeText
        })
      } catch (error) {
        if (error instanceof ShareArtifactWriteError) {
          return buildWriteFailureResponse({
            artifactPath: error.artifactPath,
            writtenArtifactsPartial: writtenArtifacts,
            rollbackFailedArtifacts: error.rollbackFailedArtifacts
          })
        }
        throw error
      }

      const runtimeArtifactsAfterExecute = await readStrictShareArtifacts({ baseDir, readText })
      const verificationAfterExecute = verifyShareLedgerAgainstRuntime({
        storage: synced.storage,
        runtimeArtifacts: runtimeArtifactsAfterExecute
      })

      return buildShareMigrationExecuteRouteResponse({
        confirmed: true,
        summary: buildExecuteSummary(),
        notice: EXECUTE_NOTICE,
        writtenArtifacts,
        artifactsToRebuildBeforeExecute: verificationBeforeExecute.artifactsToRebuild,
        artifactsToRebuildAfterExecute: verificationAfterExecute.artifactsToRebuild
      })
    } catch (error) {
      if (error instanceof ShareArtifactError) {
        return buildArtifactFailureResponse({ operation: 'execute', error })
      }

      const artifactError = createArtifactShapeError(error)
      if (artifactError) {
        return buildArtifactFailureResponse({ operation: 'execute', error: artifactError })
      }

      throw error
    }
  })
}
