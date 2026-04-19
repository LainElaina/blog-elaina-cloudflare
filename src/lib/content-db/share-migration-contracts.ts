import { buildBlogFolderTree, type BlogFolderNode } from './blog-folders.ts'

export type ShareStatus = 'published' | 'draft' | 'archived'

export type ShareMigrationListItem = {
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

export type ShareMigrationStorageRecord = ShareMigrationListItem & {
	slug: string
	status: ShareStatus
}

export type ShareMigrationStorage = {
	version: 1
	updatedAt?: string
	shares: Record<string, ShareMigrationStorageRecord>
}

export type ShareRuntimeArtifactsText = {
	list: string
	categories: string
	folders: string
	storage: string
}

const SHARE_ARTIFACT_PATHS = {
	list: 'public/share/list.json',
	categories: 'public/share/categories.json',
	folders: 'public/share/folders.json',
	storage: 'public/share/storage.json'
} as const

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

function getCanonicalFolderPath(value: { folder?: unknown; folderPath?: unknown }): string | undefined {
	return normalizeFolderPath(value.folderPath) ?? normalizeFolderPath(value.folder)
}

function sanitizeListItem(value: unknown): ShareMigrationListItem {
	const raw = value && typeof value === 'object' ? (value as Partial<ShareMigrationListItem>) : {}
	const folderPath = getCanonicalFolderPath(raw)
	return {
		name: typeof raw.name === 'string' ? raw.name : '',
		logo: typeof raw.logo === 'string' ? raw.logo : '',
		url: typeof raw.url === 'string' ? raw.url : '',
		description: typeof raw.description === 'string' ? raw.description : '',
		tags: normalizeTags(raw.tags),
		stars: normalizeStars(raw.stars),
		...(normalizeText(raw.category) ? { category: normalizeText(raw.category) } : {}),
		...(folderPath ? { folderPath } : {})
	}
}

function sanitizeStoredRecord(key: string, value: unknown): ShareMigrationStorageRecord {
	const raw = value && typeof value === 'object' ? (value as Partial<ShareMigrationStorageRecord>) : {}
	const category = normalizeText(raw.category)
	const folder = normalizeText(raw.folder)
	const folderPath = normalizeFolderPath(raw.folderPath)
	return {
		name: typeof raw.name === 'string' ? raw.name : '',
		logo: typeof raw.logo === 'string' ? raw.logo : '',
		url: typeof raw.url === 'string' ? raw.url : '',
		description: typeof raw.description === 'string' ? raw.description : '',
		tags: normalizeTags(raw.tags),
		stars: normalizeStars(raw.stars),
		...(category ? { category } : {}),
		...(folder ? { folder } : {}),
		...(folderPath ? { folderPath } : {}),
		slug: normalizeText(raw.slug) ?? key,
		status: normalizeStatus(raw.status)
	}
}

function parseJsonValue<T>(value: T | string): T {
	return typeof value === 'string' ? (JSON.parse(value) as T) : value
}

function parseListItems(value: ShareMigrationListItem[] | string): ShareMigrationListItem[] {
	const parsed = parseJsonValue<unknown>(value)
	if (!Array.isArray(parsed)) {
		return []
	}
	return parsed.map(sanitizeListItem)
}

function parseStorage(value: ShareMigrationStorage | string): ShareMigrationStorage {
	const parsed = parseJsonValue<unknown>(value)
	const raw = parsed && typeof parsed === 'object' ? (parsed as Partial<ShareMigrationStorage>) : {}
	const shares = raw.shares && typeof raw.shares === 'object' ? raw.shares : {}
	return {
		version: 1,
		...(typeof raw.updatedAt === 'string' ? { updatedAt: raw.updatedAt } : {}),
		shares: Object.fromEntries(Object.entries(shares).map(([key, record]) => [key, sanitizeStoredRecord(key, record)]))
	}
}

function parseCategories(value: { categories?: unknown } | string): { categories: string[] } {
	const parsed = parseJsonValue<unknown>(value)
	if (Array.isArray(parsed)) {
		return {
			categories: Array.from(new Set(parsed.map(normalizeText).filter((item): item is string => Boolean(item)))).sort((a, b) =>
				a.localeCompare(b)
			)
		}
	}
	const raw = parsed && typeof parsed === 'object' ? (parsed as { categories?: unknown }) : {}
	const categories = Array.isArray(raw.categories) ? raw.categories : []
	return {
		categories: Array.from(new Set(categories.map(normalizeText).filter((item): item is string => Boolean(item)))).sort((a, b) =>
			a.localeCompare(b)
		)
	}
}

function collectFolderPaths(nodes: unknown): string[] {
	if (!Array.isArray(nodes)) {
		return []
	}
	const paths: string[] = []
	const visit = (value: unknown) => {
		if (!value || typeof value !== 'object') {
			return
		}
		const raw = value as { path?: unknown; children?: unknown }
		const path = normalizeFolderPath(raw.path)
		if (path) {
			paths.push(path)
		}
		if (Array.isArray(raw.children)) {
			for (const child of raw.children) {
				visit(child)
			}
		}
	}
	for (const node of nodes) {
		visit(node)
	}
	return paths
}

function parseFolders(value: BlogFolderNode[] | string): BlogFolderNode[] {
	const parsed = parseJsonValue<unknown>(value)
	return buildBlogFolderTree(collectFolderPaths(parsed))
}

function serializeCategories(categories: string[]): string {
	return JSON.stringify({ categories }, null, 2)
}

function stringifyStable(value: unknown): string {
	const normalizeForStringify = (input: unknown): unknown => {
		if (Array.isArray(input)) {
			return input.map(item => normalizeForStringify(item))
		}
		if (!input || typeof input !== 'object') {
			return input
		}
		const entries = Object.entries(input as Record<string, unknown>)
			.filter(([, item]) => item !== undefined)
			.sort(([left], [right]) => left.localeCompare(right))
		return Object.fromEntries(entries.map(([key, item]) => [key, normalizeForStringify(item)]))
	}
	return JSON.stringify(normalizeForStringify(value))
}

function compareListItems(left: ShareMigrationListItem, right: ShareMigrationListItem): number {
	return left.url.localeCompare(right.url) || left.name.localeCompare(right.name)
}

function toRuntimeListItem(record: ShareMigrationStorageRecord): ShareMigrationListItem {
	const folderPath = getCanonicalFolderPath(record)
	return {
		name: record.name,
		logo: record.logo,
		url: record.url,
		description: record.description,
		tags: record.tags,
		stars: record.stars,
		...(record.category ? { category: record.category } : {}),
		...(folderPath ? { folderPath } : {})
	}
}

function createUniqueSlug(shares: Record<string, ShareMigrationStorageRecord>, name: string): string {
	const baseSlug = slugify(name)
	if (!shares[baseSlug]) {
		return baseSlug
	}
	let suffix = 2
	while (shares[`${baseSlug}-${suffix}`]) {
		suffix += 1
	}
	return `${baseSlug}-${suffix}`
}

function findPublishedEntryByUrl(storage: ShareMigrationStorage, url: string): [string, ShareMigrationStorageRecord] | undefined {
	return Object.entries(storage.shares).find(([, record]) => record.status === 'published' && record.url === url)
}

function createPublishedRecord(slug: string, item: ShareMigrationListItem): ShareMigrationStorageRecord {
	return {
		name: item.name,
		logo: item.logo,
		url: item.url,
		description: item.description,
		tags: item.tags,
		stars: item.stars,
		...(item.category ? { category: item.category } : {}),
		...(item.folderPath ? { folderPath: item.folderPath } : {}),
		slug,
		status: 'published'
	}
}

function buildArtifactsFromStorage(storage: ShareMigrationStorage): ShareRuntimeArtifactsText {
	const publishedRecords = Object.values(storage.shares).filter(record => record.status === 'published')
	const list = publishedRecords.map(toRuntimeListItem)
	const categories = Array.from(
		new Set(list.map(item => item.category).filter((value): value is string => Boolean(value)))
	).sort((left, right) => left.localeCompare(right))
	const folders = buildBlogFolderTree(list.map(item => item.folderPath))
	return {
		list: JSON.stringify(list, null, 2),
		categories: serializeCategories(categories),
		folders: JSON.stringify(folders, null, 2),
		storage: JSON.stringify(storage, null, 2)
	}
}

function normalizeStorageForCompare(storage: ShareMigrationStorage) {
	return {
		version: 1 as const,
		updatedAt: undefined,
		shares: Object.fromEntries(
			Object.entries(storage.shares)
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([key, record]) => {
					const folderPath = getCanonicalFolderPath(record)
					return [
						key,
						{
							name: record.name,
							logo: record.logo,
							url: record.url,
							description: record.description,
							tags: record.tags,
							stars: record.stars,
							...(record.category ? { category: record.category } : {}),
							...(folderPath ? { folderPath } : {}),
							slug: record.slug,
							status: record.status
						}
					]
				})
		)
	}
}

function normalizeArtifactsForCompare(params: {
	list: ShareMigrationListItem[] | string
	categories: { categories?: unknown } | string
	folders: BlogFolderNode[] | string
	storage: ShareMigrationStorage | string
}) {
	const list = parseListItems(params.list).sort(compareListItems)
	const categories = parseCategories(params.categories)
	const folders = parseFolders(params.folders)
	const storage = normalizeStorageForCompare(parseStorage(params.storage))
	return { list, categories, folders, storage }
}

export function syncShareRuntimeArtifactsToLedger(params: {
	list: ShareMigrationListItem[] | string
	storage: ShareMigrationStorage | string
}) {
	const runtimeList = parseListItems(params.list)
	const existingStorage = parseStorage(params.storage)
	const nextShares = Object.fromEntries(
		Object.entries(existingStorage.shares).filter(([, record]) => record.status !== 'published')
	) as Record<string, ShareMigrationStorageRecord>

	for (const item of runtimeList) {
		const existingEntry = findPublishedEntryByUrl(existingStorage, item.url)
		const preferredSlug = existingEntry?.[1]?.slug ?? createUniqueSlug(nextShares, item.name)
		const slug = nextShares[preferredSlug] ? createUniqueSlug(nextShares, item.name) : preferredSlug
		nextShares[slug] = createPublishedRecord(slug, item)
	}

	const storage: ShareMigrationStorage = {
		version: 1,
		...(existingStorage.updatedAt ? { updatedAt: existingStorage.updatedAt } : {}),
		shares: nextShares
	}

	return {
		storage,
		storageRaw: JSON.stringify(storage, null, 2),
		touchesMarkdown: false as const,
		touchesImages: false as const,
		atomic: true as const
	}
}

export function rebuildShareRuntimeArtifactsFromStorage(storageInput: ShareMigrationStorage | string) {
	const storage = parseStorage(storageInput)
	return {
		artifacts: buildArtifactsFromStorage(storage),
		touchesMarkdown: false as const,
		touchesImages: false as const,
		atomic: true as const
	}
}

export function verifyShareLedgerAgainstRuntime(params: {
	storage: ShareMigrationStorage | string
	runtimeArtifacts: ShareRuntimeArtifactsText
}) {
	const rebuilt = rebuildShareRuntimeArtifactsFromStorage(params.storage)
	const normalizedRuntime = normalizeArtifactsForCompare({
		list: params.runtimeArtifacts.list,
		categories: params.runtimeArtifacts.categories,
		folders: params.runtimeArtifacts.folders,
		storage: params.runtimeArtifacts.storage
	})
	const normalizedRebuilt = normalizeArtifactsForCompare({
		list: rebuilt.artifacts.list,
		categories: rebuilt.artifacts.categories,
		folders: rebuilt.artifacts.folders,
		storage: rebuilt.artifacts.storage
	})
	const artifactsToRebuild: string[] = []

	if (stringifyStable(normalizedRuntime.list) !== stringifyStable(normalizedRebuilt.list)) {
		artifactsToRebuild.push(SHARE_ARTIFACT_PATHS.list)
	}
	if (stringifyStable(normalizedRuntime.categories) !== stringifyStable(normalizedRebuilt.categories)) {
		artifactsToRebuild.push(SHARE_ARTIFACT_PATHS.categories)
	}
	if (stringifyStable(normalizedRuntime.folders) !== stringifyStable(normalizedRebuilt.folders)) {
		artifactsToRebuild.push(SHARE_ARTIFACT_PATHS.folders)
	}
	if (stringifyStable(normalizedRuntime.storage) !== stringifyStable(normalizedRebuilt.storage)) {
		artifactsToRebuild.push(SHARE_ARTIFACT_PATHS.storage)
	}

	return {
		artifactsToRebuild,
		normalized: normalizedRuntime,
		touchesMarkdown: false as const,
		touchesImages: false as const,
		atomic: true as const
	}
}
