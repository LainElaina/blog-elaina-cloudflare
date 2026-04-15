import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { verifyBlogLedgerAgainstRuntime } from '../src/lib/content-db/migration-contracts.ts'

type VerifyArgs = {
	baseDir?: string
	dbPath?: string
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
			args.baseDir = entry.slice('--base-dir='.length)
			continue
		}
		if (entry.startsWith('--db-path=')) {
			args.dbPath = entry.slice('--db-path='.length)
		}
	}
	return args
}

function readText(path: string): string {
	return readFileSync(path, 'utf8')
}

function readRuntimeArtifacts(baseDir: string) {
	const blogsDir = resolve(baseDir, 'public/blogs')
	return {
		index: readText(join(blogsDir, 'index.json')),
		categories: readText(join(blogsDir, 'categories.json')),
		folders: readText(join(blogsDir, 'folders.json')),
		storage: readText(join(blogsDir, 'storage.json'))
	}
}

function readLedgerStorageFromRuntime(baseDir: string): string {
	return readText(resolve(baseDir, 'public/blogs/storage.json'))
}

async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2))
	const baseDir = args.baseDir ?? process.cwd()
	const runtimeArtifacts = readRuntimeArtifacts(baseDir)
	const storageRaw = readLedgerStorageFromRuntime(baseDir)
	const parsedStorage = JSON.parse(storageRaw) as BlogStorageDB

	const result = verifyBlogLedgerAgainstRuntime({
		storageRaw,
		runtimeArtifacts
	})

	const summary = {
		ledger: {
			blogEntriesCount: Object.keys(parsedStorage.blogs ?? {}).length
		},
		verify: {
			artifactsToRebuild: result.artifactsToRebuild,
			touchesMarkdown: result.touchesMarkdown,
			touchesImages: result.touchesImages,
			atomic: result.atomic
		}
	}

	console.log(JSON.stringify(summary, null, 2))

	if (result.artifactsToRebuild.length > 0) {
		throw new Error('博客正式产物与账本不一致')
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error))
	process.exitCode = 1
})
