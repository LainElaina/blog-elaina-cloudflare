import { readFile, writeFile } from 'node:fs/promises'
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

const PREVIEW_NOTICE = '只处理 share 正式产物，不会修改 logo 图片。预检查基于当前磁盘快照。'
const EXECUTE_NOTICE = '只处理 share 正式产物，不会修改 logo 图片。执行结果已基于写回后的磁盘状态复检。'

class ShareArtifactError extends Error {
  constructor(
    readonly failureCode: ShareArtifactFailureCode,
    readonly artifactPath: string,
    message: string
  ) {
    super(message)
    this.name = 'ShareArtifactError'
  }
}

class ShareArtifactWriteError extends Error {
  constructor(
    readonly artifactPath: string,
    cause: unknown
  ) {
    const details = cause instanceof Error ? cause.message : String(cause)
    super(`写入 share 正式产物失败：${artifactPath}${details ? ` (${details})` : ''}`)
    this.name = 'ShareArtifactWriteError'
  }
}

const defaultReadText: ReadText = filePath => readFile(filePath, 'utf8')
const defaultWriteText: WriteText = (filePath, content) => writeFile(filePath, content)

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
        artifact: params.artifactPath
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
  writeText: WriteText
}) {
  const artifactEntries = [
    [LOCAL_SHARE_SAVE_PATHS.list, params.artifacts.list],
    [LOCAL_SHARE_SAVE_PATHS.categories, params.artifacts.categories],
    [LOCAL_SHARE_SAVE_PATHS.folders, params.artifacts.folders],
    [LOCAL_SHARE_SAVE_PATHS.storage, params.artifacts.storage]
  ] as const

  for (const [artifactPath, content] of artifactEntries) {
    try {
      await params.writeText(resolve(params.baseDir, artifactPath), content)
      params.writtenArtifacts.push(artifactPath)
    } catch (error) {
      throw new ShareArtifactWriteError(artifactPath, error)
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
    const runtimeArtifacts = await readStrictShareArtifacts({ baseDir, readText })
    const synced = syncShareRuntimeArtifactsToLedger({
      list: runtimeArtifacts.list,
      storage: runtimeArtifacts.storage
    })
    const verification = verifyShareLedgerAgainstRuntime({
      storage: synced.storage,
      runtimeArtifacts
    })

    return buildShareMigrationPreviewRouteResponse({
      summary: buildPreviewSummary(verification.artifactsToRebuild),
      notice: PREVIEW_NOTICE,
      artifactsToRebuild: verification.artifactsToRebuild
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

  try {
    const runtimeArtifacts = await readStrictShareArtifacts({ baseDir, readText })
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
        writeText
      })
    } catch (error) {
      if (error instanceof ShareArtifactWriteError) {
        return buildWriteFailureResponse({
          artifactPath: error.artifactPath,
          writtenArtifactsPartial: writtenArtifacts
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
}
