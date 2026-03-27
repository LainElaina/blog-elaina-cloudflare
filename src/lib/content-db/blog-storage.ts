import type { BlogIndexItem } from '@/app/blog/types'

export type BlogStatus = 'published' | 'draft' | 'archived'

export type BlogStorageRecord = {
	slug: string
	title: string
	tags: string[]
	date: string
	summary?: string
	cover?: string
	hidden?: boolean
	category?: string
	folder?: string
	status: BlogStatus
}

export type BlogStorageDB = {
	version: 1
	updatedAt: string
	blogs: Record<string, BlogStorageRecord>
}

export type StaticBlogArtifacts = {
	index: BlogIndexItem[]
	categories: string[]
	db: BlogStorageDB
}

export function createEmptyBlogStorageDB(now = new Date()): BlogStorageDB {
	return {
		version: 1,
		updatedAt: now.toISOString(),
		blogs: {}
	}
}

export function normalizeIndexItemToRecord(
	item: BlogIndexItem,
	options?: { folder?: string; status?: BlogStatus }
): BlogStorageRecord {
	return {
		slug: item.slug,
		title: item.title,
		tags: Array.isArray(item.tags) ? item.tags : [],
		date: item.date,
		summary: item.summary,
		cover: item.cover,
		hidden: item.hidden,
		category: item.category,
		folder: options?.folder,
		status: options?.status ?? 'published'
	}
}

export function upsertBlogRecord(
	db: BlogStorageDB,
	item: BlogIndexItem,
	options?: { folder?: string; status?: BlogStatus; now?: Date }
): BlogStorageDB {
	const now = options?.now ?? new Date()
	const next: BlogStorageDB = {
		...db,
		updatedAt: now.toISOString(),
		blogs: {
			...db.blogs,
			[item.slug]: normalizeIndexItemToRecord(item, {
				folder: options?.folder,
				status: options?.status
			})
		}
	}
	return next
}

export function removeBlogRecord(db: BlogStorageDB, slug: string, now = new Date()): BlogStorageDB {
	if (!db.blogs[slug]) {
		return db
	}
	const nextBlogs = { ...db.blogs }
	delete nextBlogs[slug]
	return {
		...db,
		updatedAt: now.toISOString(),
		blogs: nextBlogs
	}
}

function toBlogIndexItem(record: BlogStorageRecord): BlogIndexItem {
	return {
		slug: record.slug,
		title: record.title,
		tags: record.tags,
		date: record.date,
		summary: record.summary,
		cover: record.cover,
		hidden: record.hidden,
		category: record.category
	}
}

export function exportStaticBlogArtifacts(db: BlogStorageDB): StaticBlogArtifacts {
	const records = Object.values(db.blogs).filter(record => record.status === 'published')
	const index = records
		.map(toBlogIndexItem)
		.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
	const categories = Array.from(new Set(records.map(r => r.category).filter((v): v is string => Boolean(v)))).sort((a, b) => a.localeCompare(b))
	return {
		index,
		categories,
		db
	}
}

export function parseBlogStorageDB(raw: string | null): BlogStorageDB {
	if (!raw) {
		return createEmptyBlogStorageDB()
	}
	try {
		const parsed = JSON.parse(raw) as Partial<BlogStorageDB>
		if (parsed?.version !== 1 || !parsed.blogs || typeof parsed.blogs !== 'object') {
			return createEmptyBlogStorageDB()
		}
		return {
			version: 1,
			updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
			blogs: parsed.blogs as Record<string, BlogStorageRecord>
		}
	} catch {
		return createEmptyBlogStorageDB()
	}
}

export function buildBlogStorageFromIndex(indexItems: BlogIndexItem[], now = new Date()): BlogStorageDB {
	const db = createEmptyBlogStorageDB(now)
	return indexItems.reduce((acc, item) => upsertBlogRecord(acc, item, { now }), db)
}
