import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { syncBlogRuntimeArtifactsToLedger } from '../src/lib/content-db/migration-contracts.ts'

type Args = {
	dryRun: boolean
	confirmOverwrite: boolean
	dbPath?: string
	baseDir?: string
}

function parseArgs(argv: string[]): Args {
	const args: Args = {
		dryRun: false,
		confirmOverwrite: false
	}

	for (const entry of argv) {
		if (entry === '--dry-run') {
			args.dryRun = true
			continue
		}
		if (entry === '--confirm-overwrite') {
			args.confirmOverwrite = true
			continue
		}
		if (entry.startsWith('--db-path=')) {
			args.dbPath = entry.slice('--db-path='.length)
			continue
		}
		if (entry.startsWith('--base-dir=')) {
			args.baseDir = entry.slice('--base-dir='.length)
		}
	}

	return args
}

function readText(path: string): string {
	return readFileSync(path, 'utf8')
}

async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2))
	const baseDir = args.baseDir ?? process.cwd()
	const blogsDir = resolve(baseDir, 'public/blogs')
	const indexRaw = readText(join(blogsDir, 'index.json'))
	let storageRaw: string | null = null
	try {
		storageRaw = readText(join(blogsDir, 'storage.json'))
	} catch {
		storageRaw = null
	}

	const result = syncBlogRuntimeArtifactsToLedger({
		indexRaw,
		storageRaw
	})

	console.log(
		JSON.stringify(
			{
				dryRun: args.dryRun,
				confirmOverwrite: args.confirmOverwrite,
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

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error))
	process.exitCode = 1
})
