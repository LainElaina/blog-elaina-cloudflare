import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { syncBlogRuntimeArtifactsToLedger, verifyBlogLedgerAgainstRuntime } from '../src/lib/content-db/migration-contracts.ts'

type VerifyArgs = {
	baseDir?: string
	dbPath?: string
}

const OPERATION = 'verify-db-migration'

class VerifyArgumentError extends Error {
	failureCode = 'ARGUMENT_INVALID'

	constructor(message: string) {
		super(message)
		this.name = 'VerifyArgumentError'
	}
}

class VerifyArtifactError extends Error {
	constructor(
		readonly failureCode: 'ARTIFACT_INVALID' | 'ARTIFACT_MISSING',
		message: string,
		readonly artifactPath: string
	) {
		super(message)
		this.name = 'VerifyArtifactError'
	}
}

type BlogStorageRecord = {
	slug: string
	title: string
	tags: string[]
	date: string
	summary?: string
	cover?: string
	hidden?: boolean
	category?: string
	folderPath?: string
	favorite?: boolean
	status: 'published' | 'draft' | 'archived'
}

type BlogStorageDB = {
	version: 1
	updatedAt: string
	blogs: Record<string, BlogStorageRecord>
}

function parseArgs(argv: string[]): VerifyArgs {
	const args: VerifyArgs = {}
	for (const entry of argv) {
		if (entry.startsWith('--base-dir=')) {
			const value = entry.slice('--base-dir='.length)
			if (!value) {
				throw new VerifyArgumentError('--base-dir 需要提供路径值')
			}
			args.baseDir = value
			continue
		}
		if (entry.startsWith('--db-path=')) {
			args.dbPath = entry.slice('--db-path='.length)
			continue
		}
		throw new VerifyArgumentError(`未知参数：${entry}`)
	}
	return args
}

function hasErrorCode(error: unknown, code: string) {
	return error && typeof error === 'object' && 'code' in error && error.code === code
}

function readText(path: string, artifactPath?: string): string {
	try {
		return readFileSync(path, 'utf8')
	} catch (error) {
		if (artifactPath && hasErrorCode(error, 'ENOENT')) {
			throw new VerifyArtifactError('ARTIFACT_MISSING', `缺少博客运行时产物：${artifactPath}`, artifactPath)
		}
		throw error
	}
}

function readOptionalText(path: string): string | null {
	try {
		return readText(path)
	} catch (error) {
		if (hasErrorCode(error, 'ENOENT')) {
			return null
		}
		throw error
	}
}

function parseJsonArtifact(artifactPath: string, raw: string) {
	try {
		return JSON.parse(raw) as unknown
	} catch (error) {
		if (error instanceof SyntaxError) {
			throw new VerifyArtifactError('ARTIFACT_INVALID', `博客运行时产物 JSON 无效：${artifactPath}`, artifactPath)
		}
		throw error
	}
}

function assertJsonArtifact(artifactPath: string, raw: string) {
	parseJsonArtifact(artifactPath, raw)
}

function assertIndexArtifactShape(artifactPath: string, raw: string) {
	if (!Array.isArray(parseJsonArtifact(artifactPath, raw))) {
		throw new VerifyArtifactError('ARTIFACT_INVALID', `博客运行时产物结构无效：${artifactPath}`, artifactPath)
	}
}

function assertCategoriesArtifactShape(artifactPath: string, raw: string) {
	const parsed = parseJsonArtifact(artifactPath, raw) as { categories?: unknown }
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !Array.isArray(parsed.categories)) {
		throw new VerifyArtifactError('ARTIFACT_INVALID', `博客运行时产物结构无效：${artifactPath}`, artifactPath)
	}
}

function assertFoldersArtifactShape(artifactPath: string, raw: string) {
	if (!Array.isArray(parseJsonArtifact(artifactPath, raw))) {
		throw new VerifyArtifactError('ARTIFACT_INVALID', `博客运行时产物结构无效：${artifactPath}`, artifactPath)
	}
}

function assertStorageArtifactShape(artifactPath: string, raw: string) {
	const parsed = parseJsonArtifact(artifactPath, raw) as { version?: unknown; updatedAt?: unknown; blogs?: unknown }
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || parsed.version !== 1 || typeof parsed.updatedAt !== 'string' || !parsed.blogs || typeof parsed.blogs !== 'object' || Array.isArray(parsed.blogs)) {
		throw new VerifyArtifactError('ARTIFACT_INVALID', `博客运行时产物结构无效：${artifactPath}`, artifactPath)
	}
}

function readRuntimeArtifacts(baseDir: string) {
	const blogsDir = resolve(baseDir, 'public/blogs')
	const artifacts = {
		index: readText(join(blogsDir, 'index.json'), 'public/blogs/index.json'),
		categories: readText(join(blogsDir, 'categories.json'), 'public/blogs/categories.json'),
		folders: readText(join(blogsDir, 'folders.json'), 'public/blogs/folders.json'),
		storage: readOptionalText(join(blogsDir, 'storage.json'))
	}
	assertIndexArtifactShape('public/blogs/index.json', artifacts.index)
	assertCategoriesArtifactShape('public/blogs/categories.json', artifacts.categories)
	assertFoldersArtifactShape('public/blogs/folders.json', artifacts.folders)
	if (artifacts.storage !== null) {
		assertStorageArtifactShape('public/blogs/storage.json', artifacts.storage)
	}
	return artifacts
}

function readLedgerStorageFromRuntime(baseDir: string): string | null {
	return readOptionalText(resolve(baseDir, 'public/blogs/storage.json'))
}

async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2))
	const baseDir = args.baseDir ?? process.cwd()
	const runtimeArtifacts = readRuntimeArtifacts(baseDir)
	const storageRaw = readLedgerStorageFromRuntime(baseDir)
	const synced = syncBlogRuntimeArtifactsToLedger({
		indexRaw: runtimeArtifacts.index,
		storageRaw
	})
	const parsedStorage = JSON.parse(synced.storageRaw) as BlogStorageDB
	const result = verifyBlogLedgerAgainstRuntime({
		storageRaw: synced.storageRaw,
		runtimeArtifacts: {
			index: runtimeArtifacts.index,
			categories: runtimeArtifacts.categories,
			folders: runtimeArtifacts.folders,
			storage: runtimeArtifacts.storage ?? synced.storageRaw
		}
	})

	const artifactsToRebuild = runtimeArtifacts.storage === null
		? Array.from(new Set(['public/blogs/storage.json', ...result.artifactsToRebuild]))
		: result.artifactsToRebuild

	const summary = {
		ledger: {
			blogEntriesCount: Object.keys(parsedStorage.blogs ?? {}).length
		},
		verify: {
			artifactsToRebuild,
			touchesMarkdown: result.touchesMarkdown,
			touchesImages: result.touchesImages,
			atomic: result.atomic
		}
	}

	console.log(JSON.stringify(summary, null, 2))

	if (artifactsToRebuild.length > 0) {
		throw new Error('博客正式产物与账本不一致')
	}
}

main().catch((error) => {
	if (error instanceof VerifyArgumentError || error instanceof VerifyArtifactError) {
		const failure = {
			ok: false,
			operation: OPERATION,
			code: error.failureCode,
			message: error.message,
			artifactPath: error instanceof VerifyArtifactError ? error.artifactPath : undefined
		}
		console.log(JSON.stringify(failure, null, 2))
		console.error(error.message)
		process.exitCode = 1
		return
	}
	console.error(error instanceof Error ? error.message : String(error))
	process.exitCode = 1
})
