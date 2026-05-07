import { existsSync, readFileSync } from 'node:fs'
import { copyFile, mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { parseRequiredBlogStorageDB, type BlogStatus } from './blog-storage.ts'
import { createContentDb, getDefaultContentDbPath, type ContentDb } from './client.ts'
import { applyContentDbMigrations } from './migrations.ts'
import {
	rebuildBlogRuntimeArtifactsFromStorage,
	syncBlogRuntimeArtifactsToLedger,
	verifyBlogLedgerAgainstRuntime
} from './migration-contracts.ts'
import { parseRequiredShareStorageDB, type ShareStatus } from './share-storage.ts'

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

type BlogMigrationEntry = {
	slug: string
	title: string
	status: BlogStatus
	categoryKey: string | null
	folderKey: string | null
	metadata: Record<string, unknown>
	bodyPath: string | null
}


type ShareItem = {
	name: string
	url?: string
	logo?: string
	description?: string
	tags?: string[]
	stars?: number
	category?: string
	folder?: string
	folderPath?: string
}

type ShareMigrationEntry = {
	id: string
	slug: string
	title: string
	status: ShareStatus
	categoryKey: string | null
	folderKey: string | null
	metadata: Record<string, unknown>
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

async function loadLegacyBlogs(baseDir: string): Promise<BlogMigrationEntry[]> {
	const blogsDir = resolve(baseDir, 'public/blogs')
	const storagePath = join(blogsDir, 'storage.json')
	if (existsSync(storagePath)) {
		return Object.values(parseRequiredBlogStorageDB(readFileSync(storagePath, 'utf8')).blogs).map(record => ({
			slug: record.slug,
			title: record.title || record.slug,
			status: record.status,
			categoryKey: record.category ?? null,
			folderKey: record.folderPath ?? record.folder ?? null,
			metadata: { storage: record },
			bodyPath: record.status === 'published' ? `/public/blogs/${record.slug}/index.md` : null
		}))
	}

	const indexItems = readJsonFile<BlogIndexItem[]>(join(blogsDir, 'index.json'))
	const categories = readJsonFile<{ categories?: string[] }>(join(blogsDir, 'categories.json'))
	const categoryKeys = Array.isArray(categories.categories) ? categories.categories : []

	const dirEntries = await readdir(blogsDir, { withFileTypes: true })
	const availableSlugs = new Set(dirEntries.filter(entry => entry.isDirectory()).map(entry => entry.name))

	const result: BlogMigrationEntry[] = []
	for (const item of indexItems) {
		if (!item.slug) {
			continue
		}
		if (!availableSlugs.has(item.slug)) {
			throw new Error(`Legacy blog index references missing blog directory: ${item.slug}`)
		}

		const configPath = join(blogsDir, item.slug, 'config.json')
		const config: Record<string, unknown> = existsSync(configPath) ? readJsonFile<Record<string, unknown>>(configPath) : {}
		const categoryKey = item.category && item.category.trim() ? item.category : null
		result.push({
			slug: item.slug,
			title: item.title || item.slug,
			status: 'published',
			categoryKey,
			folderKey: null,
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

function normalizeShareFolderKey(item: ShareItem): string | null {
	return item.folderPath ?? item.folder ?? null
}

function buildShareEntriesFromList(list: ShareItem[]): ShareMigrationEntry[] {
	const slugCounter = new Map<string, number>()

	return list.map((item) => {
		const baseSlug = slugify(item.name)
		const used = slugCounter.get(baseSlug) ?? 0
		slugCounter.set(baseSlug, used + 1)
		const slug = used === 0 ? baseSlug : `${baseSlug}-${used + 1}`
		return {
			id: `share:${slug}`,
			slug,
			title: item.name,
			status: 'published',
			categoryKey: item.category ?? null,
			folderKey: normalizeShareFolderKey(item),
			metadata: item as Record<string, unknown>
		}
	})
}

function loadLegacyShareEntries(baseDir: string): ShareMigrationEntry[] {
	const storagePath = resolve(baseDir, 'public/share/storage.json')
	if (existsSync(storagePath)) {
		return Object.values(parseRequiredShareStorageDB(readFileSync(storagePath, 'utf8')).shares).map((record) => ({
			id: `share:${record.slug}`,
			slug: record.slug,
			title: record.name,
			status: record.status,
			categoryKey: record.category ?? null,
			folderKey: record.folderPath ?? record.folder ?? null,
			metadata: record as Record<string, unknown>
		}))
	}

	const publicShareListPath = resolve(baseDir, 'public/share/list.json')
	if (existsSync(publicShareListPath)) {
		return buildShareEntriesFromList(readJsonFile<ShareItem[]>(publicShareListPath))
	}

	return buildShareEntriesFromList(readJsonFile<ShareItem[]>(resolve(baseDir, 'src/app/share/list.json')))
}

export function syncBlogRuntimeArtifacts(params: { indexRaw: string; storageRaw: string | null }) {
	return syncBlogRuntimeArtifactsToLedger(params)
}

async function withDryRunContentDb<T>(dbPath: string, callback: (db: ContentDb) => Promise<T>): Promise<T> {
	if (dbPath === ':memory:' || !existsSync(dbPath)) {
		const db = createContentDb(':memory:')
		try {
			applyContentDbMigrations(db)
			return await callback(db)
		} finally {
			db.close()
		}
	}

	const tmpDir = await mkdtemp(join(tmpdir(), 'content-db-dry-run-'))
	const tmpDbPath = join(tmpDir, 'content.db')
	try {
		await copyFile(dbPath, tmpDbPath)
		const db = createContentDb(tmpDbPath)
		try {
			applyContentDbMigrations(db)
			return await callback(db)
		} finally {
			db.close()
		}
	} finally {
		await rm(tmpDir, { recursive: true, force: true })
	}
}


export function rebuildBlogRuntimeArtifacts(storageRaw: string) {
	return rebuildBlogRuntimeArtifactsFromStorage(storageRaw)
}

export function verifyBlogRuntimeArtifacts(params: {
	storageRaw: string
	runtimeArtifacts: {
		index: string
		categories: string
		folders: string
		storage: string
	}
}) {
	return verifyBlogLedgerAgainstRuntime(params)
}

export async function migrateLegacyContentToDb(options: MigrateLegacyContentOptions = {}): Promise<MigrationResult> {
	const baseDir = options.baseDir ?? process.cwd()
	const dbPath = options.dbPath ?? getDefaultContentDbPath(baseDir)
	const dryRun = Boolean(options.dryRun)
	const confirmOverwrite = Boolean(options.confirmOverwrite)
	const siteConfig = readJsonFile<SiteConfig>(resolve(baseDir, 'src/config/site-content.json'))
	const layoutConfig = readJsonFile<LayoutConfig>(resolve(baseDir, 'src/config/card-styles.json'))
	const blogs = await loadLegacyBlogs(baseDir)
	const shares = loadLegacyShareEntries(baseDir)

	async function runWithDb(db: ContentDb): Promise<MigrationResult> {
		const before = countTables(db)
		const hasMigratedData = before.siteConfig > 0 || before.layoutConfig > 0 || before.blogEntries > 0 || before.shareEntries > 0
		if (hasMigratedData && !confirmOverwrite && !dryRun) {
			throw new Error('Database already contains migrated data; re-run with confirmOverwrite=true to overwrite')
		}

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
						blog.status,
						blog.categoryKey,
						blog.folderKey,
						JSON.stringify(blog.metadata),
						blog.bodyPath
					)
				}

				const insertShare = db.prepare('INSERT INTO share_entries (id, slug, title, status, category_key, folder_key, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?)')
				for (const share of shares) {
					insertShare.run(share.id, share.slug, share.title, share.status, share.categoryKey, share.folderKey, JSON.stringify(share.metadata))
				}

				db.exec('COMMIT')
			} catch (error) {
				db.exec('ROLLBACK')
				throw error
			}
		}

		const after = dryRun ? before : countTables(db)

		return {
			dryRun,
			before,
			after,
			imported: {
				siteConfig: siteConfig ? 1 : 0,
				layoutConfig: layoutConfig ? 1 : 0,
				blogEntries: blogs.length,
				shareEntries: shares.length
			}
		}
	}

	if (dryRun) {
		return withDryRunContentDb(dbPath, runWithDb)
	}

	const db = createContentDb(dbPath)
	applyContentDbMigrations(db)
	try {
		return await runWithDb(db)
	} finally {
		db.close()
	}
}
