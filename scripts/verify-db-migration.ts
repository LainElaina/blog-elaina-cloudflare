import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { createContentDb, getDefaultContentDbPath } from '../src/lib/content-db/client.ts'
import { applyContentDbMigrations } from '../src/lib/content-db/migrations.ts'

type VerifyArgs = {
	baseDir?: string
	dbPath?: string
}

type BlogIndexEntry = { slug: string }
type ShareEntry = { name: string; url?: string }
type BlogRow = { slug: string; body_path: string | null }
type ShareRow = { slug: string; title: string; metadata_json: string }

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

function slugify(value: string): string {
	const slug = value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
	return slug || 'item'
}

function buildShareSlugs(list: ShareEntry[]): string[] {
	const counter = new Map<string, number>()
	return list.map((item) => {
		const baseSlug = slugify(item.name)
		const used = counter.get(baseSlug) ?? 0
		counter.set(baseSlug, used + 1)
		return used === 0 ? baseSlug : `${baseSlug}-${used + 1}`
	})
}

async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2))
	const baseDir = args.baseDir ?? process.cwd()
	const dbPath = args.dbPath ?? getDefaultContentDbPath(baseDir)
	const blogsDir = resolve(baseDir, 'public/blogs')

	const blogIndex = readJson<BlogIndexEntry[]>(join(blogsDir, 'index.json'))
	const shareList = readJson<ShareEntry[]>(resolve(baseDir, 'src/app/share/list.json'))
	const expectedBlogSlugs = blogIndex.map((entry) => entry.slug).filter(Boolean)
	const expectedShareSlugs = buildShareSlugs(shareList)

	const db = createContentDb(dbPath)
	applyContentDbMigrations(db)
	try {
		const siteCount = Number((db.prepare('SELECT COUNT(1) as count FROM site_config').get() as { count: number }).count)
		const layoutCount = Number((db.prepare('SELECT COUNT(1) as count FROM layout_config').get() as { count: number }).count)
		const blogCount = Number((db.prepare('SELECT COUNT(1) as count FROM blog_entries').get() as { count: number }).count)
		const shareCount = Number((db.prepare('SELECT COUNT(1) as count FROM share_entries').get() as { count: number }).count)

		const hasSite = Boolean(db.prepare('SELECT 1 FROM site_config WHERE id = 1').get())
		const hasLayout = Boolean(db.prepare('SELECT 1 FROM layout_config WHERE id = 1').get())
		const missingBlogSlugs = expectedBlogSlugs.filter((slug) => !db.prepare('SELECT 1 FROM blog_entries WHERE slug = ?').get(slug))
		const missingShareSlugs = expectedShareSlugs.filter((slug) => !db.prepare('SELECT 1 FROM share_entries WHERE slug = ?').get(slug))
		const invalidBlogBodyPaths = expectedBlogSlugs.filter((slug) => {
			const row = db.prepare('SELECT slug, body_path FROM blog_entries WHERE slug = ?').get(slug) as BlogRow | undefined
			return !row || row.body_path !== `/public/blogs/${slug}/index.md`
		})
		const invalidShareMappings = expectedShareSlugs.filter((slug, index) => {
			const row = db.prepare('SELECT slug, title, metadata_json FROM share_entries WHERE slug = ?').get(slug) as ShareRow | undefined
			if (!row) {
				return true
			}
			const metadata = JSON.parse(row.metadata_json) as ShareEntry
			const expected = shareList[index]
			return row.title !== expected?.name || metadata.url !== expected?.url
		})

		const summary = {
			legacy: {
				blogIndexCount: expectedBlogSlugs.length,
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
				missingBlogSlugs,
				missingShareSlugs,
				invalidBlogBodyPaths,
				invalidShareMappings
			}
		}

		console.log(JSON.stringify(summary, null, 2))

		if (!hasSite || !hasLayout) {
			throw new Error('关键记录校验失败')
		}
		if (siteCount !== 1 || layoutCount !== 1) {
			throw new Error('站点配置或布局配置数量不匹配')
		}
		if (blogCount !== expectedBlogSlugs.length || shareCount !== expectedShareSlugs.length) {
			throw new Error('数据库行数与旧内容数量不匹配')
		}
		if (missingBlogSlugs.length > 0 || missingShareSlugs.length > 0) {
			throw new Error('关键记录校验失败')
		}
		if (invalidBlogBodyPaths.length > 0 || invalidShareMappings.length > 0) {
			throw new Error('内容映射校验失败')
		}
	} finally {
		db.close()
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error))
	process.exitCode = 1
})
