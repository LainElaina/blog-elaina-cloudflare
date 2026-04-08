import { buildBlogFolderTree, type BlogFolderNode } from './blog-folders.ts'

export type ShareStatus = 'published' | 'draft' | 'archived'

export type ShareListItem = {
	name: string
	logo: string
	url: string
	description: string
	tags: string[]
	stars: number
	category?: string
	folder?: string
	folderPath?: string
}

export type ShareStorageRecord = ShareListItem & {
	slug: string
	status: ShareStatus
}

export type ShareStorageDB = {
	version: 1
	updatedAt: string
	shares: Record<string, ShareStorageRecord>
}

export type StaticShareArtifacts = {
	list: ShareListItem[]
	categories: string[]
	folders: BlogFolderNode[]
	db: ShareStorageDB
}

function slugify(value: string): string {
	const slug = value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
	return slug || 'item'
}

function normalizeText(value: unknown): string | undefined {
	if (typeof value !== 'string') {
		return undefined
	}
	const normalized = value.trim()
	return normalized.length > 0 ? normalized : undefined
}

function normalizeFolderPath(value: unknown): string | undefined {
	const normalized = normalizeText(value)
	if (!normalized) {
		return undefined
	}
	const parts = normalized.split('/').filter(Boolean)
	return parts.length > 0 ? `/${parts.join('/')}` : undefined
}

function normalizeTags(value: unknown): string[] {
	if (!Array.isArray(value) || !value.every(tag => typeof tag === 'string')) {
		return []
	}
	return value.map(tag => tag.trim()).filter(Boolean)
}

function normalizeStars(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function normalizeStatus(value: unknown): ShareStatus {
	return value === 'draft' || value === 'archived' || value === 'published' ? value : 'published'
}

function sanitizeShareListItem(value: unknown): ShareListItem {
	const raw = value && typeof value === 'object' ? (value as Partial<ShareListItem>) : {}
	return {
		name: typeof raw.name === 'string' ? raw.name : '',
		logo: typeof raw.logo === 'string' ? raw.logo : '',
		url: typeof raw.url === 'string' ? raw.url : '',
		description: typeof raw.description === 'string' ? raw.description : '',
		tags: normalizeTags(raw.tags),
		stars: normalizeStars(raw.stars),
		category: normalizeText(raw.category),
		folder: normalizeText(raw.folder),
		folderPath: normalizeFolderPath(raw.folderPath)
	}
}

function sanitizeShareStorageRecord(key: string, value: unknown): ShareStorageRecord {
	const raw = value && typeof value === 'object' ? (value as Partial<ShareStorageRecord>) : {}
	const item = sanitizeShareListItem(raw)
	return {
		...item,
		slug: normalizeText(raw.slug) ?? key,
		status: normalizeStatus(raw.status)
	}
}

function findShareEntryByUrl(
	db: ShareStorageDB,
	url: string,
	status?: ShareStatus
): [string, ShareStorageRecord] | undefined {
	return Object.entries(db.shares).find(([, record]) => record.url === url && (status ? record.status === status : true))
}

function createUniqueShareSlug(db: ShareStorageDB, name: string): string {
	const baseSlug = slugify(name)
	if (!db.shares[baseSlug]) {
		return baseSlug
	}
	let suffix = 2
	while (db.shares[`${baseSlug}-${suffix}`]) {
		suffix += 1
	}
	return `${baseSlug}-${suffix}`
}

function toListItem(record: ShareStorageRecord): ShareListItem {
	return {
		name: record.name,
		logo: record.logo,
		url: record.url,
		description: record.description,
		tags: record.tags,
		stars: record.stars,
		...(record.category ? { category: record.category } : {}),
		...(record.folder ? { folder: record.folder } : {}),
		...(record.folderPath ? { folderPath: record.folderPath } : {})
	}
}

export function createEmptyShareStorageDB(now = new Date()): ShareStorageDB {
	return {
		version: 1,
		updatedAt: now.toISOString(),
		shares: {}
	}
}

export function upsertShareRecord(
	db: ShareStorageDB,
	item: ShareListItem,
	options?: { now?: Date; currentUrl?: string }
): ShareStorageDB {
	const now = options?.now ?? new Date()
	const sanitized = sanitizeShareListItem(item)
	const existingEntry = findShareEntryByUrl(db, options?.currentUrl ?? sanitized.url, 'published')
	const existingKey = existingEntry?.[0]
	const existing = existingEntry?.[1]
	const slug = existing?.slug ?? createUniqueShareSlug(db, sanitized.name)
	const nextShares = { ...db.shares }
	if (existingKey && existingKey !== slug) {
		delete nextShares[existingKey]
	}

	return {
		...db,
		updatedAt: now.toISOString(),
		shares: {
			...nextShares,
			[slug]: {
				...(existing ?? {}),
				name: sanitized.name,
				logo: sanitized.logo,
				url: sanitized.url,
				description: sanitized.description,
				tags: sanitized.tags,
				stars: sanitized.stars,
				...(sanitized.category ? { category: sanitized.category } : {}),
				...(sanitized.folder ? { folder: sanitized.folder } : {}),
				...(sanitized.folderPath ? { folderPath: sanitized.folderPath } : {}),
				slug,
				status: existing?.status ?? 'published'
			}
		}
	}
}

export function buildShareStorageFromList(items: ShareListItem[], now = new Date()): ShareStorageDB {
	return items.reduce((db, item) => upsertShareRecord(db, item, { now }), createEmptyShareStorageDB(now))
}

export function exportStaticShareArtifacts(db: ShareStorageDB): StaticShareArtifacts {
	const records = Object.values(db.shares).filter(record => record.status === 'published')
	const list = records.map(toListItem)
	const categories = Array.from(new Set(records.map(record => record.category).filter((value): value is string => Boolean(value)))).sort((a, b) =>
		a.localeCompare(b)
	)
	const folders = buildBlogFolderTree(records.map(record => record.folderPath))
	return {
		list,
		categories,
		folders,
		db
	}
}

export function parseShareStorageDB(raw: string | null): ShareStorageDB {
	if (!raw) {
		return createEmptyShareStorageDB()
	}
	try {
		const parsed = JSON.parse(raw) as Partial<ShareStorageDB>
		if (parsed?.version !== 1 || !parsed.shares || typeof parsed.shares !== 'object') {
			return createEmptyShareStorageDB()
		}
		return {
			version: 1,
			updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
			shares: Object.fromEntries(Object.entries(parsed.shares).map(([key, value]) => [key, sanitizeShareStorageRecord(key, value)]))
		}
	} catch {
		return createEmptyShareStorageDB()
	}
}
