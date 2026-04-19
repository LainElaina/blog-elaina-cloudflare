import { LOCAL_SHARE_SAVE_PATHS, serializeShareCategories } from '../../app/share/services/share-artifacts.ts'
import { buildBlogFolderTree, type BlogFolderNode } from './blog-folders.ts'
import {
	exportStaticShareArtifacts,
	parseShareStorageDB,
	type ShareListItem as BaseShareListItem,
	type ShareStatus as BaseShareStatus,
	type ShareStorageDB,
	type ShareStorageRecord as BaseShareStorageRecord
} from './share-storage.ts'

export type ShareStatus = BaseShareStatus
export type ShareMigrationListItem = BaseShareListItem
export type ShareMigrationStorageRecord = BaseShareStorageRecord

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

const SHARE_ARTIFACT_PATHS = LOCAL_SHARE_SAVE_PATHS
const RUNTIME_HELPER_UPDATED_AT = '1970-01-01T00:00:00.000Z'

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

function getCanonicalFolderPath(value: { folder?: unknown; folderPath?: unknown }): string | undefined {
	return normalizeFolderPath(value.folderPath) ?? normalizeFolderPath(value.folder)
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function createInvalidJsonError(label: string, error: unknown): Error {
	const message = error instanceof Error ? error.message : String(error)
	return new Error(`${label}: 非法 JSON - ${message}`)
}

function createInvalidShapeError(label: string, reason: string): Error {
	return new Error(`${label}: 非法 shape - ${reason}`)
}

function parseJsonValue<T>(value: T | string, label: string): unknown {
	if (typeof value !== 'string') {
		return value
	}
	try {
		return JSON.parse(value) as unknown
	} catch (error) {
		throw createInvalidJsonError(label, error)
	}
}

function expectRecord(value: unknown, label: string): Record<string, unknown> {
	if (!isRecord(value)) {
		throw createInvalidShapeError(label, '期望对象')
	}
	return value
}

function expectArray(value: unknown, label: string): unknown[] {
	if (!Array.isArray(value)) {
		throw createInvalidShapeError(label, '期望数组')
	}
	return value
}

function sanitizeListItem(value: Record<string, unknown>): ShareMigrationListItem {
	const folderPath = getCanonicalFolderPath(value)
	return {
		name: typeof value.name === 'string' ? value.name : '',
		logo: typeof value.logo === 'string' ? value.logo : '',
		url: typeof value.url === 'string' ? value.url : '',
		description: typeof value.description === 'string' ? value.description : '',
		tags: normalizeTags(value.tags),
		stars: normalizeStars(value.stars),
		...(normalizeText(value.category) ? { category: normalizeText(value.category) } : {}),
		...(folderPath ? { folderPath } : {})
	}
}

function parseListItems(value: ShareMigrationListItem[] | string, label: string): ShareMigrationListItem[] {
	const parsed = expectArray(parseJsonValue(value, label), label)
	return parsed.map((item, index) => sanitizeListItem(expectRecord(item, `${label}[${index}]`)))
}

function parseStorage(value: ShareMigrationStorage | string, label: string): ShareMigrationStorage {
	const parsed = expectRecord(parseJsonValue(value, label), label)
	if (parsed.version !== 1) {
		throw createInvalidShapeError(`${label}.version`, '期望值 1')
	}
	const shares = parsed.shares
	if (!isRecord(shares)) {
		throw createInvalidShapeError(`${label}.shares`, '期望对象')
	}
	for (const [key, record] of Object.entries(shares)) {
		expectRecord(record, `${label}.shares.${key}`)
	}
	const sanitized = parseShareStorageDB(
		JSON.stringify({
			version: 1,
			updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : RUNTIME_HELPER_UPDATED_AT,
			shares
		})
	)
	return {
		version: 1,
		...(typeof parsed.updatedAt === 'string' ? { updatedAt: parsed.updatedAt } : {}),
		shares: sanitized.shares
	}
}

function normalizeCategoryList(values: unknown[]): string[] {
	return Array.from(new Set(values.map(normalizeText).filter((item): item is string => Boolean(item)))).sort((a, b) =>
		a.localeCompare(b)
	)
}

function parseCategories(value: { categories?: unknown } | string, label: string): { categories: string[] } {
	const parsed = parseJsonValue(value, label)
	if (Array.isArray(parsed)) {
		return { categories: normalizeCategoryList(parsed) }
	}
	const raw = expectRecord(parsed, label)
	if (!Array.isArray(raw.categories)) {
		throw createInvalidShapeError(`${label}.categories`, '期望数组')
	}
	return {
		categories: normalizeCategoryList(raw.categories)
	}
}

function validateFolderNodeShape(value: unknown, label: string) {
	const raw = expectRecord(value, label)
	if (raw.path !== undefined && typeof raw.path !== 'string') {
		throw createInvalidShapeError(`${label}.path`, '期望字符串')
	}
	if (raw.children !== undefined && !Array.isArray(raw.children)) {
		throw createInvalidShapeError(`${label}.children`, '期望数组')
	}
	if (Array.isArray(raw.children)) {
		for (const [index, child] of raw.children.entries()) {
			validateFolderNodeShape(child, `${label}.children[${index}]`)
		}
	}
}

function collectFolderPaths(nodes: unknown[]): string[] {
	const paths: string[] = []
	const visit = (value: unknown) => {
		if (!isRecord(value)) {
			return
		}
		const path = normalizeFolderPath(value.path)
		if (path) {
			paths.push(path)
		}
		if (Array.isArray(value.children)) {
			for (const child of value.children) {
				visit(child)
			}
		}
	}
	for (const node of nodes) {
		visit(node)
	}
	return paths
}

function parseFolders(value: BlogFolderNode[] | string, label: string): BlogFolderNode[] {
	const parsed = expectArray(parseJsonValue(value, label), label)
	for (const [index, node] of parsed.entries()) {
		validateFolderNodeShape(node, `${label}[${index}]`)
	}
	return buildBlogFolderTree(collectFolderPaths(parsed))
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

function toRuntimeArtifactsStorage(storage: ShareMigrationStorage): ShareStorageDB {
	return {
		version: 1,
		updatedAt: storage.updatedAt ?? RUNTIME_HELPER_UPDATED_AT,
		shares: Object.fromEntries(
			Object.entries(storage.shares).map(([key, record]) => {
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

function buildArtifactsFromStorage(storage: ShareMigrationStorage): ShareRuntimeArtifactsText {
	const artifacts = exportStaticShareArtifacts(toRuntimeArtifactsStorage(storage))
	return {
		list: JSON.stringify(artifacts.list, null, 2),
		categories: serializeShareCategories(artifacts.categories),
		folders: JSON.stringify(artifacts.folders, null, 2),
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
	const list = parseListItems(params.list, 'runtimeArtifacts.list').sort(compareListItems)
	const categories = parseCategories(params.categories, 'runtimeArtifacts.categories')
	const folders = parseFolders(params.folders, 'runtimeArtifacts.folders')
	const storage = normalizeStorageForCompare(parseStorage(params.storage, 'runtimeArtifacts.storage'))
	return { list, categories, folders, storage }
}

export function syncShareRuntimeArtifactsToLedger(params: {
	list: ShareMigrationListItem[] | string
	storage: ShareMigrationStorage | string
}) {
	const runtimeList = parseListItems(params.list, 'list')
	const existingStorage = parseStorage(params.storage, 'storage')
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
	const storage = parseStorage(storageInput, 'storage')
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
	const storage = parseStorage(params.storage, 'storage')
	const rebuilt = rebuildShareRuntimeArtifactsFromStorage(storage)
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
