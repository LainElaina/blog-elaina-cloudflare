import { readFile, rename, rm, writeFile } from 'node:fs/promises'
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

function isFileNotFoundError(error: unknown) {
	return error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT'
}

async function readOptionalText(filePath: string) {
	try {
		return await readFile(filePath, 'utf8')
	} catch (error) {
		if (isFileNotFoundError(error)) {
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

async function writeRuntimeArtifacts(baseDir: string, artifacts: { index: string; categories: string; folders: string; storage: string }) {
	const blogsDir = resolve(baseDir, 'public/blogs')
	const writes = [
		{ path: join(blogsDir, 'index.json'), content: artifacts.index },
		{ path: join(blogsDir, 'categories.json'), content: artifacts.categories },
		{ path: join(blogsDir, 'folders.json'), content: artifacts.folders },
		{ path: join(blogsDir, 'storage.json'), content: artifacts.storage }
	]
	const timestamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`
	const preparedWrites = writes.map(write => ({
		...write,
		tempPath: `${write.path}.${timestamp}.tmp`,
		backupPath: `${write.path}.${timestamp}.bak`,
		hadExistingFile: true
	}))
	const replacedWrites: typeof preparedWrites = []

	try {
		for (const write of preparedWrites) {
			await writeFile(write.tempPath, write.content)
		}

		for (const write of preparedWrites) {
			try {
				await rename(write.path, write.backupPath)
			} catch (error) {
				if (!isFileNotFoundError(error)) {
					throw error
				}
				write.hadExistingFile = false
			}
			replacedWrites.push(write)
			await rename(write.tempPath, write.path)
		}
	} catch (error) {
		for (const write of replacedWrites.reverse()) {
			await rm(write.path, { force: true }).catch(() => undefined)
			if (write.hadExistingFile) {
				await rename(write.backupPath, write.path).catch(() => undefined)
			}
		}
		throw error
	} finally {
		await Promise.all(preparedWrites.flatMap(write => [rm(write.tempPath, { force: true }), rm(write.backupPath, { force: true })]))
	}
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
		writtenArtifacts: [BLOG_ARTIFACT_PATHS.index, BLOG_ARTIFACT_PATHS.categories, BLOG_ARTIFACT_PATHS.folders, BLOG_ARTIFACT_PATHS.storage],
		artifactsToRebuildBeforeExecute: verificationBeforeExecute.artifactsToRebuild,
		artifactsToRebuildAfterExecute: verificationAfterExecute.artifactsToRebuild
	})
}
