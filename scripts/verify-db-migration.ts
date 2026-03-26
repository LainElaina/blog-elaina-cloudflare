import { readFileSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'

import { createContentDb, getDefaultContentDbPath } from '../src/lib/content-db/client.ts'
import { applyContentDbMigrations } from '../src/lib/content-db/migrations.ts'

type VerifyArgs = {
	baseDir?: string
	dbPath?: string
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

function readJson<T>(path: string): T {
	return JSON.parse(readFileSync(path, 'utf8')) as T
}

async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2))
	const baseDir = args.baseDir ?? process.cwd()
	const dbPath = args.dbPath ?? getDefaultContentDbPath(baseDir)
	const blogsDir = resolve(baseDir, 'public/blogs')

	const blogIndex = readJson<Array<{ slug: string }>>(join(blogsDir, 'index.json'))
	const shareList = readJson<Array<{ name: string }>>(resolve(baseDir, 'src/app/share/list.json'))

	const blogDirs = (await readdir(blogsDir, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name)
	const blogDirCount = blogDirs.length

	const db = createContentDb(dbPath)
	applyContentDbMigrations(db)
	try {
		const siteCount = Number((db.prepare('SELECT COUNT(1) as count FROM site_config').get() as { count: number }).count)
		const layoutCount = Number((db.prepare('SELECT COUNT(1) as count FROM layout_config').get() as { count: number }).count)
		const blogCount = Number((db.prepare('SELECT COUNT(1) as count FROM blog_entries').get() as { count: number }).count)
		const shareCount = Number((db.prepare('SELECT COUNT(1) as count FROM share_entries').get() as { count: number }).count)

		const hasSite = Boolean(db.prepare('SELECT 1 FROM site_config WHERE id = 1').get())
		const hasLayout = Boolean(db.prepare('SELECT 1 FROM layout_config WHERE id = 1').get())
		const hasAnyBlog = blogIndex.length > 0 ? Boolean(db.prepare('SELECT 1 FROM blog_entries WHERE slug = ?').get(blogIndex[0]!.slug)) : true
		const hasAnyShare = shareList.length > 0 ? Boolean(db.prepare('SELECT 1 FROM share_entries WHERE title = ?').get(shareList[0]!.name)) : true

		const summary = {
			legacy: {
				blogIndexCount: blogIndex.length,
				blogDirectoryCount: blogDirCount,
				shareListCount: shareList.length
			},
			database: {
				siteConfigCount: siteCount,
				layoutConfigCount: layoutCount,
				blogEntriesCount: blogCount,
				shareEntriesCount: shareCount
			},
			keyRecords: {
				hasSiteConfig: hasSite,
				hasLayoutConfig: hasLayout,
				hasSampleBlog: hasAnyBlog,
				hasSampleShare: hasAnyShare
			}
		}

		console.log(JSON.stringify(summary, null, 2))

		if (!hasSite || !hasLayout || !hasAnyBlog || !hasAnyShare) {
			throw new Error('关键记录校验失败')
		}
	} finally {
		db.close()
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error))
	process.exitCode = 1
})
