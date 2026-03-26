import { existsSync, readFileSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'

import { createContentDb, getDefaultContentDbPath, type ContentDb } from './client.ts'
import { applyContentDbMigrations } from './migrations.ts'

type SiteConfig = Record<string, unknown>
type LayoutConfig = Record<string, unknown>

type BlogIndexItem = {
	slug: string
	title?: string
	tags?: string[]
	date?: string
	summary?: string
	cover?: string
	hidden?: boolean
	category?: string
}

type BlogConfig = Record<string, unknown>

type BlogCategories = { categories?: string[] }

type ShareItem = {
	name: string
	url?: string
	logo?: string
	description?: string
	tags?: string[]
	stars?: number
}

export type MigrationCounters = {
	siteConfig: number
	layoutConfig: number
	blogEntries: number
	shareEntries: number
}

export type MigrationResult = {
	dryRun: boolean
	before: MigrationCounters
	after: MigrationCounters
	imported: {
		siteConfig: number
		layoutConfig: number
		blogEntries: number
		shareEntries: number
	}
}

export type MigrateLegacyContentOptions = {
	baseDir?: string
	dbPath?: string
	dryRun?: boolean
	confirmOverwrite?: boolean
}

function readJsonFile<T>(path: string): T {
	return JSON.parse(readFileSync(path, 'utf8')) as T
}

function countTables(db: ContentDb): MigrationCounters {
	const siteConfig = Number((db.prepare('SELECT COUNT(1) as count FROM site_config').get() as { count: number }).count)
	const layoutConfig = Number((db.prepare('SELECT COUNT(1) as count FROM layout_config').get() as { count: number }).count)
	const blogEntries = Number((db.prepare('SELECT COUNT(1) as count FROM blog_entries').get() as { count: number }).count)
	const shareEntries = Number((db.prepare('SELECT COUNT(1) as count FROM share_entries').get() as { count: number }).count)
	return { siteConfig, layoutConfig, blogEntries, shareEntries }
}

function slugify(value: string): string {
	const slug = value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
	return slug || 'item'
}

async function loadLegacyBlogs(baseDir: string): Promise<Array<{ slug: string; title: string; categoryKey: string | null; metadata: Record<string, unknown>; bodyPath: string }>> {
	const blogsDir = resolve(baseDir, 'public/blogs')
	const indexItems = readJsonFile<BlogIndexItem[]>(join(blogsDir, 'index.json'))
	const categories = readJsonFile<BlogCategories>(join(blogsDir, 'categories.json'))
	const categoryKeys = Array.isArray(categories.categories) ? categories.categories : []

	const dirEntries = await readdir(blogsDir, { withFileTypes: true })
	const availableSlugs = new Set(dirEntries.filter((entry) => entry.isDirectory()).map((entry) => entry.name))

	const result: Array<{ slug: string; title: string; categoryKey: string | null; metadata: Record<string, unknown>; bodyPath: string }> = []
	for (const item of indexItems) {
		if (!item.slug || !availableSlugs.has(item.slug)) {
			continue
		}

		const configPath = join(blogsDir, item.slug, 'config.json')
		const config: BlogConfig = existsSync(configPath) ? readJsonFile<BlogConfig>(configPath) : {}
		const categoryKey = item.category && item.category.trim() ? item.category : null
		result.push({
			slug: item.slug,
			title: item.title || item.slug,
			categoryKey,
			bodyPath: `/public/blogs/${item.slug}/index.md`,
			metadata: {
				index: item,
				config,
				categories: categoryKeys
			}
		})
	}

	return result
}

function loadLegacyShareEntries(baseDir: string): Array<{ id: string; slug: string; title: string; metadata: Record<string, unknown> }> {
	const shareListPath = resolve(baseDir, 'src/app/share/list.json')
	const list = readJsonFile<ShareItem[]>(shareListPath)
	const slugCounter = new Map<string, number>()

	return list.map((item, index) => {
		const baseSlug = slugify(item.name)
		const used = slugCounter.get(baseSlug) ?? 0
		slugCounter.set(baseSlug, used + 1)
		const slug = used === 0 ? baseSlug : `${baseSlug}-${used + 1}`
		return {
			id: `share:${slug}`,
			slug,
			title: item.name,
			metadata: item as Record<string, unknown>
		}
	})
}

export async function migrateLegacyContentToDb(options: MigrateLegacyContentOptions = {}): Promise<MigrationResult> {
	const baseDir = options.baseDir ?? process.cwd()
	const dbPath = options.dbPath ?? getDefaultContentDbPath(baseDir)
	const dryRun = Boolean(options.dryRun)
	const confirmOverwrite = Boolean(options.confirmOverwrite)

	const db = createContentDb(dbPath)
	applyContentDbMigrations(db)

	try {
		const before = countTables(db)
		const hasMigratedData = before.siteConfig > 0 || before.layoutConfig > 0 || before.blogEntries > 0 || before.shareEntries > 0
		if (hasMigratedData && !confirmOverwrite && !dryRun) {
			throw new Error('Database already contains migrated data; re-run with confirmOverwrite=true to overwrite')
		}

		const siteConfig = readJsonFile<SiteConfig>(resolve(baseDir, 'src/config/site-content.json'))
		const layoutConfig = readJsonFile<LayoutConfig>(resolve(baseDir, 'src/config/card-styles.json'))
		const blogs = await loadLegacyBlogs(baseDir)
		const shares = loadLegacyShareEntries(baseDir)

		if (!dryRun) {
			db.exec('BEGIN')
			try {
				db.exec('DELETE FROM site_config')
				db.exec('DELETE FROM layout_config')
				db.exec('DELETE FROM blog_entries')
				db.exec('DELETE FROM share_entries')

				db.prepare('INSERT INTO site_config (id, payload) VALUES (1, ?)').run(JSON.stringify(siteConfig))
				db.prepare('INSERT INTO layout_config (id, payload) VALUES (1, ?)').run(JSON.stringify(layoutConfig))

				const insertBlog = db.prepare(
					'INSERT INTO blog_entries (id, slug, title, status, category_key, folder_key, metadata_json, body_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
				)
				for (const blog of blogs) {
					insertBlog.run(
						`blog:${blog.slug}`,
						blog.slug,
						blog.title,
						'published',
						blog.categoryKey,
						null,
						JSON.stringify(blog.metadata),
						blog.bodyPath
					)
				}

				const insertShare = db.prepare('INSERT INTO share_entries (id, slug, title, status, category_key, folder_key, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?)')
				for (const share of shares) {
					insertShare.run(share.id, share.slug, share.title, 'published', null, null, JSON.stringify(share.metadata))
				}

				db.exec('COMMIT')
			} catch (error) {
				db.exec('ROLLBACK')
				throw error
			}
		}

		const after = dryRun
			? {
					siteConfig: 1,
					layoutConfig: 1,
					blogEntries: blogs.length,
					shareEntries: shares.length
				}
			: countTables(db)

		return {
			dryRun,
			before,
			after,
			imported: {
				siteConfig: Math.max(0, after.siteConfig - before.siteConfig),
				layoutConfig: Math.max(0, after.layoutConfig - before.layoutConfig),
				blogEntries: Math.max(0, after.blogEntries - before.blogEntries),
				shareEntries: Math.max(0, after.shareEntries - before.shareEntries)
			}
		}
	} finally {
		db.close()
	}
}
