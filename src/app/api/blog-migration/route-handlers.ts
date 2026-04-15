import { readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

import {
  rebuildBlogRuntimeArtifactsFromStorage,
  syncBlogRuntimeArtifactsToLedger,
  verifyBlogLedgerAgainstRuntime
} from '../../../lib/content-db/migration-contracts.ts'
import { buildExecuteResponse, buildPreviewRouteResponse, enforceDevelopmentOnly } from './blog-migration-route-helper.ts'

const BLOG_ARTIFACT_PATHS = {
  index: 'public/blogs/index.json',
  categories: 'public/blogs/categories.json',
  folders: 'public/blogs/folders.json',
  storage: 'public/blogs/storage.json'
} as const

async function readOptionalText(filePath: string) {
  try {
    return await readFile(filePath, 'utf8')
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null
    }
    throw error
  }
}

async function readRuntimeArtifacts(baseDir: string) {
  const blogsDir = resolve(baseDir, 'public/blogs')
  const [index, categories, folders, storageRaw] = await Promise.all([
    readFile(join(blogsDir, 'index.json'), 'utf8'),
    readFile(join(blogsDir, 'categories.json'), 'utf8'),
    readFile(join(blogsDir, 'folders.json'), 'utf8'),
    readOptionalText(join(blogsDir, 'storage.json'))
  ])

  return {
    index,
    categories,
    folders,
    storageRaw
  }
}

async function writeRuntimeArtifacts(
  baseDir: string,
  artifacts: { index: string; categories: string; folders: string; storage: string }
) {
  const blogsDir = resolve(baseDir, 'public/blogs')
  await Promise.all([
    writeFile(join(blogsDir, 'index.json'), artifacts.index),
    writeFile(join(blogsDir, 'categories.json'), artifacts.categories),
    writeFile(join(blogsDir, 'folders.json'), artifacts.folders),
    writeFile(join(blogsDir, 'storage.json'), artifacts.storage)
  ])
}

export async function previewRoute(params: { nodeEnv: string; baseDir?: string }) {
  const access = enforceDevelopmentOnly(params.nodeEnv)
  if (!access.allowed) {
    return {
      status: access.status,
      body: { message: access.message }
    }
  }

  const baseDir = params.baseDir ?? process.cwd()
  const runtimeArtifacts = await readRuntimeArtifacts(baseDir)
  const synced = syncBlogRuntimeArtifactsToLedger({
    indexRaw: runtimeArtifacts.index,
    storageRaw: runtimeArtifacts.storageRaw
  })
  const verification = verifyBlogLedgerAgainstRuntime({
    storageRaw: synced.storageRaw,
    runtimeArtifacts: {
      index: runtimeArtifacts.index,
      categories: runtimeArtifacts.categories,
      folders: runtimeArtifacts.folders,
      storage: runtimeArtifacts.storageRaw ?? ''
    }
  })

  return buildPreviewRouteResponse({
    artifactsToRebuild: verification.artifactsToRebuild
  })
}

export async function executeRoute(params: { nodeEnv: string; confirmed: boolean; baseDir?: string }) {
  const access = enforceDevelopmentOnly(params.nodeEnv)
  if (!access.allowed) {
    return {
      status: access.status,
      body: { message: access.message }
    }
  }

  if (!params.confirmed) {
    return buildExecuteResponse({ confirmed: false })
  }

  const baseDir = params.baseDir ?? process.cwd()
  const runtimeArtifacts = await readRuntimeArtifacts(baseDir)
  const synced = syncBlogRuntimeArtifactsToLedger({
    indexRaw: runtimeArtifacts.index,
    storageRaw: runtimeArtifacts.storageRaw
  })
  const verificationBeforeExecute = verifyBlogLedgerAgainstRuntime({
    storageRaw: synced.storageRaw,
    runtimeArtifacts: {
      index: runtimeArtifacts.index,
      categories: runtimeArtifacts.categories,
      folders: runtimeArtifacts.folders,
      storage: runtimeArtifacts.storageRaw ?? ''
    }
  })
  const rebuilt = rebuildBlogRuntimeArtifactsFromStorage(synced.storageRaw)

  await writeRuntimeArtifacts(baseDir, rebuilt.artifacts)

  const verificationAfterExecute = verifyBlogLedgerAgainstRuntime({
    storageRaw: synced.storageRaw,
    runtimeArtifacts: rebuilt.artifacts
  })

  return buildExecuteResponse({
    confirmed: true,
    writtenArtifacts: [
      BLOG_ARTIFACT_PATHS.index,
      BLOG_ARTIFACT_PATHS.categories,
      BLOG_ARTIFACT_PATHS.folders,
      BLOG_ARTIFACT_PATHS.storage
    ],
    artifactsToRebuildBeforeExecute: verificationBeforeExecute.artifactsToRebuild,
    artifactsToRebuildAfterExecute: verificationAfterExecute.artifactsToRebuild
  })
}
