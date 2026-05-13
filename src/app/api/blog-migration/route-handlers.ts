import { createHash } from 'node:crypto'
import { readFile, realpath, rename, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

import {
	rebuildBlogRuntimeArtifactsFromStorage,
	syncBlogRuntimeArtifactsToLedger,
	verifyBlogLedgerAgainstRuntime
} from '../../../lib/content-db/migration-contracts.ts'
import { isPathInsideDirectory } from '../local-path.ts'
import { withLocalContentMutationLock } from '../local-content-mutation-lock.ts'
import { assertSafeBlogSlug } from '../../write/services/blog-slug.ts'
import { buildExecuteResponse, buildPreviewRouteResponse, enforceDevelopmentOnly } from './blog-migration-route-helper.ts'

const BLOG_ARTIFACT_PATHS = {
	index: 'public/blogs/index.json',
	categories: 'public/blogs/categories.json',
	folders: 'public/blogs/folders.json',
	storage: 'public/blogs/storage.json'
} as const

const EMPTY_BLOG_STORAGE_ARTIFACT = JSON.stringify({
	version: 1,
	updatedAt: '',
	blogs: {}
})

type BlogArtifactFailureCode = 'ARTIFACT_MISSING' | 'ARTIFACT_INVALID_JSON' | 'ARTIFACT_INVALID_SHAPE'

type BlogRuntimeArtifactsText = {
	index: string
	categories: string
	folders: string
	storageRaw: string | null
}

type BlogRuntimeArtifactsToWrite = {
	index: string
	categories: string
	folders: string
	storage: string
}

type WriteBlogRuntimeArtifacts = (baseDir: string, artifacts: BlogRuntimeArtifactsToWrite) => Promise<void>
type BlogArtifactSnapshot = {
	artifacts: BlogRuntimeArtifactsText
	snapshotHash: string
}

class BlogArtifactError extends Error {
	readonly failureCode: BlogArtifactFailureCode
	readonly artifactPath: string

	constructor(failureCode: BlogArtifactFailureCode, artifactPath: string, message: string) {
		super(message)
		this.name = 'BlogArtifactError'
		this.failureCode = failureCode
		this.artifactPath = artifactPath
	}
}

class BlogArtifactPathError extends Error {
	constructor(message = '博客正式产物路径不合法') {
		super(message)
		this.name = 'BlogArtifactPathError'
	}
}


function isFileNotFoundError(error: unknown) {
	return error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT'
}

function isFileAlreadyExistsError(error: unknown) {
	return error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST'
}

async function reserveBackupPath(basePath: string) {
	for (let attempt = 0; attempt < 100; attempt += 1) {
		const candidate = attempt === 0 ? basePath : `${basePath}.${attempt}`
		try {
			await writeFile(candidate, '', { flag: 'wx' })
			return candidate
		} catch (error) {
			if (!isFileAlreadyExistsError(error)) {
				throw error
			}
		}
	}

	throw new Error('无法预留博客正式产物备份路径')
}

function isObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isSafeBlogArtifactSlug(slug: string) {
	try {
		assertSafeBlogSlug(slug)
		return true
	} catch {
		return false
	}
}

function parseStrictJson(raw: string, artifactPath: string) {
	try {
		return JSON.parse(raw) as unknown
	} catch {
		throw new BlogArtifactError('ARTIFACT_INVALID_JSON', artifactPath, `${artifactPath} 不是合法 JSON`)
	}
}

function throwInvalidShape(artifactPath: string): never {
	throw new BlogArtifactError('ARTIFACT_INVALID_SHAPE', artifactPath, `${artifactPath} 的内容结构不合法`)
}

async function readRequiredText(baseDir: string, artifactPath: string) {
	try {
		return await readFile(resolve(baseDir, artifactPath), 'utf8')
	} catch (error) {
		if (isFileNotFoundError(error)) {
			throw new BlogArtifactError('ARTIFACT_MISSING', artifactPath, `缺少博客正式产物：${artifactPath}`)
		}
		throw error
	}
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

function validateBlogIndexArtifact(raw: string) {
	const artifactPath = BLOG_ARTIFACT_PATHS.index
	const parsed = parseStrictJson(raw, artifactPath)
	if (!Array.isArray(parsed)) throwInvalidShape(artifactPath)

	const seenSlugs = new Set<string>()
	for (const item of parsed) {
		if (
			!isObject(item) ||
			typeof item.slug !== 'string' ||
			!isSafeBlogArtifactSlug(item.slug) ||
			seenSlugs.has(item.slug) ||
			typeof item.title !== 'string' ||
			!Array.isArray(item.tags) ||
			!item.tags.every(tag => typeof tag === 'string') ||
			typeof item.date !== 'string' ||
			('summary' in item && typeof item.summary !== 'string') ||
			('cover' in item && typeof item.cover !== 'string') ||
			('hidden' in item && typeof item.hidden !== 'boolean') ||
			('category' in item && typeof item.category !== 'string') ||
			('folderPath' in item && typeof item.folderPath !== 'string') ||
			('favorite' in item && typeof item.favorite !== 'boolean')
		) {
			throwInvalidShape(artifactPath)
		}

		seenSlugs.add(item.slug)
	}
}

function validateBlogCategoriesArtifact(raw: string) {
	const artifactPath = BLOG_ARTIFACT_PATHS.categories
	const parsed = parseStrictJson(raw, artifactPath)
	if (!isObject(parsed) || !Array.isArray(parsed.categories) || !parsed.categories.every(category => typeof category === 'string')) {
		throwInvalidShape(artifactPath)
	}
}

function isBlogFolderNode(value: unknown): value is { name: string; path: string; children: unknown[] } {
	return isObject(value) && typeof value.name === 'string' && typeof value.path === 'string' && Array.isArray(value.children)
}

function validateBlogFolderNodes(nodes: unknown[]): boolean {
	return nodes.every(node => isBlogFolderNode(node) && validateBlogFolderNodes(node.children))
}

function validateBlogFoldersArtifact(raw: string) {
	const artifactPath = BLOG_ARTIFACT_PATHS.folders
	const parsed = parseStrictJson(raw, artifactPath)
	if (!Array.isArray(parsed) || !validateBlogFolderNodes(parsed)) {
		throwInvalidShape(artifactPath)
	}
}

function validateBlogStorageArtifact(raw: string | null) {
	if (raw === null) return

	const artifactPath = BLOG_ARTIFACT_PATHS.storage
	const parsed = parseStrictJson(raw, artifactPath)
	if (!isObject(parsed) || parsed.version !== 1 || typeof parsed.updatedAt !== 'string' || !isObject(parsed.blogs)) {
		throwInvalidShape(artifactPath)
	}

	for (const [slug, record] of Object.entries(parsed.blogs)) {
		if (
			!isSafeBlogArtifactSlug(slug) ||
			!isObject(record) ||
			record.slug !== slug ||
			typeof record.title !== 'string' ||
			!Array.isArray(record.tags) ||
			!record.tags.every(tag => typeof tag === 'string') ||
			typeof record.date !== 'string' ||
			!['published', 'draft', 'archived'].includes(String(record.status)) ||
			('summary' in record && typeof record.summary !== 'string') ||
			('cover' in record && typeof record.cover !== 'string') ||
			('hidden' in record && typeof record.hidden !== 'boolean') ||
			('category' in record && typeof record.category !== 'string') ||
			('folderPath' in record && typeof record.folderPath !== 'string') ||
			('favorite' in record && typeof record.favorite !== 'boolean')
		) {
			throwInvalidShape(artifactPath)
		}
	}
}

function validateStrictBlogArtifacts(runtimeArtifacts: BlogRuntimeArtifactsText) {
	validateBlogIndexArtifact(runtimeArtifacts.index)
	validateBlogCategoriesArtifact(runtimeArtifacts.categories)
	validateBlogFoldersArtifact(runtimeArtifacts.folders)
	validateBlogStorageArtifact(runtimeArtifacts.storageRaw)
}

function buildArtifactFailureResponse(error: BlogArtifactError) {
	return {
		status: 400,
		body: {
			message: error.message,
			code: error.failureCode,
			details: {
				artifact: error.artifactPath
			}
		}
	}
}

function createBlogArtifactSnapshotHash(runtimeArtifacts: BlogRuntimeArtifactsText) {
	return createHash('sha256')
		.update(
			JSON.stringify([
				runtimeArtifacts.index,
				runtimeArtifacts.categories,
				runtimeArtifacts.folders,
				runtimeArtifacts.storageRaw
			])
		)
		.digest('hex')
}

function buildStalePreviewResponse(params: {
	expectedSnapshotHash: string | undefined
	actualSnapshotHash: string
}) {
	return {
		status: 409,
		body: {
			ok: false,
			code: 'STALE_PREVIEW',
			message: '预检查快照已过期，请重新预检查后再执行',
			shouldRepreview: true,
			details: {
				expectedSnapshotHash: params.expectedSnapshotHash ?? null,
				actualSnapshotHash: params.actualSnapshotHash
			}
		}
	}
}

async function readRuntimeArtifactSnapshot(baseDir: string): Promise<BlogArtifactSnapshot> {
	const artifacts = await readRuntimeArtifacts(baseDir)
	validateStrictBlogArtifacts(artifacts)

	return {
		artifacts,
		snapshotHash: createBlogArtifactSnapshotHash(artifacts)
	}
}

async function readRuntimeArtifacts(baseDir: string): Promise<BlogRuntimeArtifactsText> {
	const blogsDir = resolve(baseDir, 'public/blogs')
	await assertSafeExistingBlogArtifactsDirectory(baseDir, blogsDir)
	const [index, categories, folders, storageRaw] = await Promise.all([
		readRequiredText(baseDir, BLOG_ARTIFACT_PATHS.index),
		readRequiredText(baseDir, BLOG_ARTIFACT_PATHS.categories),
		readRequiredText(baseDir, BLOG_ARTIFACT_PATHS.folders),
		readOptionalText(join(blogsDir, 'storage.json'))
	])

	return {
		index,
		categories,
		folders,
		storageRaw
	}
}

function assertSafeBlogArtifactsDirectory(baseDir: string, blogsDir: string) {
	const projectDir = resolve(baseDir)
	const expectedBlogsDir = resolve(projectDir, 'public/blogs')
	if (blogsDir !== expectedBlogsDir || !isPathInsideDirectory(projectDir, blogsDir)) {
		throw new BlogArtifactPathError()
	}
}

async function assertSafeExistingBlogArtifactsDirectory(baseDir: string, blogsDir: string) {
	assertSafeBlogArtifactsDirectory(baseDir, blogsDir)
	const realProjectDir = await realpath(resolve(baseDir))
	const realBlogsDir = await realpath(blogsDir)
	if (realBlogsDir !== resolve(realProjectDir, 'public/blogs')) {
		throw new BlogArtifactPathError()
	}
}

async function writeRuntimeArtifacts(baseDir: string, artifacts: BlogRuntimeArtifactsToWrite) {
	const blogsDir = resolve(baseDir, 'public/blogs')
	await assertSafeExistingBlogArtifactsDirectory(baseDir, blogsDir)
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
		hadExistingFile: true,
		reservedBackupPath: false
	}))
	const replacedWrites: typeof preparedWrites = []

	try {
		for (const write of preparedWrites) {
			write.backupPath = await reserveBackupPath(write.backupPath)
			write.reservedBackupPath = true
		}

		for (const write of preparedWrites) {
			await writeFile(write.tempPath, write.content, { flag: 'wx' })
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
		await Promise.all(preparedWrites.flatMap(write => [
			rm(write.tempPath, { force: true }).catch(() => undefined),
			write.reservedBackupPath ? rm(write.backupPath, { force: true }).catch(() => undefined) : Promise.resolve()
		]))
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
	return withLocalContentMutationLock(baseDir, 'blog', async () => {
		try {
			const runtimeSnapshot = await readRuntimeArtifactSnapshot(baseDir)
			const synced = syncBlogRuntimeArtifactsToLedger({
				indexRaw: runtimeSnapshot.artifacts.index,
				storageRaw: runtimeSnapshot.artifacts.storageRaw
			})
			const runtimeStorageArtifact = runtimeSnapshot.artifacts.storageRaw ?? EMPTY_BLOG_STORAGE_ARTIFACT
			const verification = verifyBlogLedgerAgainstRuntime({
				storageRaw: synced.storageRaw,
				runtimeArtifacts: {
					index: runtimeSnapshot.artifacts.index,
					categories: runtimeSnapshot.artifacts.categories,
					folders: runtimeSnapshot.artifacts.folders,
					storage: runtimeStorageArtifact
				}
			})

			return buildPreviewRouteResponse({
				artifactsToRebuild: verification.artifactsToRebuild,
				snapshotHash: runtimeSnapshot.snapshotHash
			})
		} catch (error) {
			if (error instanceof BlogArtifactError) {
				return buildArtifactFailureResponse(error)
			}
			if (error instanceof BlogArtifactPathError) {
				return {
					status: 403,
					body: { message: error.message }
				}
			}
			throw error
		}
	})
}

export async function executeRoute(params: { nodeEnv: string; confirmed: boolean; snapshotHash?: string; baseDir?: string; writeRuntimeArtifactsForTest?: WriteBlogRuntimeArtifacts }) {
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
	const writeRuntimeArtifactsImpl = params.writeRuntimeArtifactsForTest ?? writeRuntimeArtifacts
	return withLocalContentMutationLock(baseDir, 'blog', async () => {
		try {
			const runtimeSnapshot = await readRuntimeArtifactSnapshot(baseDir)
			if (params.snapshotHash !== runtimeSnapshot.snapshotHash) {
				return buildStalePreviewResponse({
					expectedSnapshotHash: params.snapshotHash,
					actualSnapshotHash: runtimeSnapshot.snapshotHash
				})
			}

			const runtimeArtifacts = runtimeSnapshot.artifacts
			const synced = syncBlogRuntimeArtifactsToLedger({
				indexRaw: runtimeArtifacts.index,
				storageRaw: runtimeArtifacts.storageRaw
			})
			const runtimeStorageArtifact = runtimeArtifacts.storageRaw ?? EMPTY_BLOG_STORAGE_ARTIFACT
			const verificationBeforeExecute = verifyBlogLedgerAgainstRuntime({
				storageRaw: synced.storageRaw,
				runtimeArtifacts: {
					index: runtimeArtifacts.index,
					categories: runtimeArtifacts.categories,
					folders: runtimeArtifacts.folders,
					storage: runtimeStorageArtifact
				}
			})
			const rebuilt = rebuildBlogRuntimeArtifactsFromStorage(synced.storageRaw)

			try {
				await writeRuntimeArtifactsImpl(baseDir, rebuilt.artifacts)
			} catch {
				return {
					status: 500,
					body: {
						ok: false,
						code: 'WRITE_FAILED',
						message: '写入博客正式产物失败',
						shouldRepreview: true
					}
				}
			}

			const runtimeArtifactsAfterExecute = await readRuntimeArtifacts(baseDir)
			validateStrictBlogArtifacts(runtimeArtifactsAfterExecute)
			const verificationAfterExecute = verifyBlogLedgerAgainstRuntime({
				storageRaw: synced.storageRaw,
				runtimeArtifacts: {
					index: runtimeArtifactsAfterExecute.index,
					categories: runtimeArtifactsAfterExecute.categories,
					folders: runtimeArtifactsAfterExecute.folders,
					storage: runtimeArtifactsAfterExecute.storageRaw ?? EMPTY_BLOG_STORAGE_ARTIFACT
				}
			})

			return buildExecuteResponse({
				confirmed: true,
				writtenArtifacts: [BLOG_ARTIFACT_PATHS.index, BLOG_ARTIFACT_PATHS.categories, BLOG_ARTIFACT_PATHS.folders, BLOG_ARTIFACT_PATHS.storage],
				artifactsToRebuildBeforeExecute: verificationBeforeExecute.artifactsToRebuild,
				artifactsToRebuildAfterExecute: verificationAfterExecute.artifactsToRebuild
			})
		} catch (error) {
			if (error instanceof BlogArtifactError) {
				return buildArtifactFailureResponse(error)
			}
			if (error instanceof BlogArtifactPathError) {
				return {
					status: 403,
					body: { message: error.message }
				}
			}
			throw error
		}
	})
}
