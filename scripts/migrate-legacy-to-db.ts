import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { syncBlogRuntimeArtifactsToLedger } from '../src/lib/content-db/migration-contracts.ts'

const OPERATION = 'migrate-legacy-to-db'

type Args = {
	baseDir?: string
}

class MigrationCliError extends Error {
	failureCode = 'ARGUMENT_INVALID'

	constructor(message: string) {
		super(message)
		this.name = 'MigrationCliError'
	}
}

function parseArgs(argv: string[]): Args {
	const args: Args = {}

	for (let index = 0; index < argv.length; index += 1) {
		const entry = argv[index]
		if (entry === '--dry-run') {
			continue
		}
		if (entry === '--base-dir') {
			const value = argv[index + 1]
			if (!value || value.startsWith('--')) {
				throw new MigrationCliError('--base-dir 需要提供路径值')
			}
			args.baseDir = value
			index += 1
			continue
		}
		if (entry.startsWith('--base-dir=')) {
			const value = entry.slice('--base-dir='.length)
			if (!value) {
				throw new MigrationCliError('--base-dir 需要提供路径值')
			}
			args.baseDir = value
			continue
		}
		if (entry === '--confirm-overwrite' || entry.startsWith('--db-path=')) {
			throw new MigrationCliError('migrate-legacy-to-db 仅输出预览，不会写入数据库；请改用重建工具或移除写入参数')
		}
		throw new MigrationCliError(`未知参数：${entry}`)
	}

	return args
}

function readText(path: string): string {
	return readFileSync(path, 'utf8')
}

function hasErrorCode(error: unknown, code: string) {
	return error && typeof error === 'object' && 'code' in error && error.code === code
}

async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2))
	const baseDir = args.baseDir ?? process.cwd()
	const blogsDir = resolve(baseDir, 'public/blogs')
	const indexRaw = readText(join(blogsDir, 'index.json'))
	let storageRaw: string | null = null
	try {
		storageRaw = readText(join(blogsDir, 'storage.json'))
	} catch (error) {
		if (!hasErrorCode(error, 'ENOENT')) {
			throw error
		}
		storageRaw = null
	}

	const result = syncBlogRuntimeArtifactsToLedger({
		indexRaw,
		storageRaw
	})

	console.log(
		JSON.stringify(
			{
				mode: 'preview',
				ledger: {
					storageRaw: result.storageRaw
				},
				contract: {
					touchesMarkdown: result.touchesMarkdown,
					touchesImages: result.touchesImages,
					atomic: result.atomic
				}
			},
			null,
			2
		)
	)
}

main().catch(error => {
	if (error instanceof MigrationCliError) {
		const failure = {
			ok: false,
			operation: OPERATION,
			code: error.failureCode,
			message: error.message
		}
		console.log(JSON.stringify(failure, null, 2))
		console.error(error.message)
		process.exitCode = 1
		return
	}
	console.error(error instanceof Error ? error.message : String(error))
	process.exitCode = 1
})
