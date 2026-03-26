import { migrateLegacyContentToDb } from '../src/lib/content-db/migration.ts'

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

async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2))
	const result = await migrateLegacyContentToDb({
		baseDir: args.baseDir,
		dbPath: args.dbPath,
		dryRun: args.dryRun,
		confirmOverwrite: args.confirmOverwrite
	})

	console.log(
		JSON.stringify(
			{
				dryRun: result.dryRun,
				before: result.before,
				after: result.after,
				imported: result.imported
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
