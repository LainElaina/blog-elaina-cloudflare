import { LOCAL_SHARE_SAVE_PATHS, serializeShareCategories } from '../../app/share/services/share-artifacts.ts'
import type { BlogFolderNode } from './blog-folders.ts'
import {
	exportStaticShareArtifacts,
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

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
	return Object.prototype.hasOwnProperty.call(value, key)
}

function createInvalidJsonError(label: string, error: unknown): Error {
	const message = error instanceof Error ? error.message : String(error)
	return new Error(`${label}: 非法 JSON - ${message}`)
}

function createInvalidShapeError(label: string, reason: string): Error {
	return new Error(`${label}: 非法 shape - ${reason}`)
}

function createDuplicateUrlError(label: string, url: string): Error {
	return new Error(`${label}: 重复 URL - ${url}`)
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

function expectString(value: unknown, label: string): string {
	if (typeof value !== 'string') {
		throw createInvalidShapeError(label, '期望字符串')
	}
	return value
}

function parseOptionalText(value: unknown, label: string): string | undefined {
	if (value === undefined) {
		return undefined
	}
	return normalizeText(expectString(value, label))
}

function parseTags(value: unknown, label: string): string[] {
	const tags = expectArray(value, label)
	return tags.map((tag, index) => expectString(tag, `${label}[${index}]`).trim()).filter(Boolean)
}

function parseStars(value: unknown, label: string): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		throw createInvalidShapeError(label, '期望有限数字')
	}
	return value
}

function parseStatus(value: unknown, label: string): ShareStatus {
	if (value !== 'published' && value !== 'draft' && value !== 'archived') {
		throw createInvalidShapeError(label, '期望 published | draft | archived')
	}
	return value
}

function parseSlug(value: unknown, label: string): string {
	const slug = normalizeText(expectString(value, label))
	if (!slug) {
		throw createInvalidShapeError(label, '期望非空字符串')
	}
	return slug
}

function parseCanonicalFolderPath(raw: Record<string, unknown>, label: string): string | undefined {
	if (hasOwn(raw, 'folderPath') && raw.folderPath !== undefined) {
		return normalizeFolderPath(expectString(raw.folderPath, `${label}.folderPath`))
	}
	if (hasOwn(raw, 'folder') && raw.folder !== undefined) {
		return normalizeFolderPath(expectString(raw.folder, `${label}.folder`))
	}
	return undefined
}

function parseListItem(value: unknown, label: string): ShareMigrationListItem {
	const raw = expectRecord(value, label)
	const category = parseOptionalText(raw.category, `${label}.category`)
	const folderPath = parseCanonicalFolderPath(raw, label)
	return {
		name: expectString(raw.name, `${label}.name`),
		logo: expectString(raw.logo, `${label}.logo`),
		url: expectString(raw.url, `${label}.url`),
		description: expectString(raw.description, `${label}.description`),
		tags: parseTags(raw.tags, `${label}.tags`),
		stars: parseStars(raw.stars, `${label}.stars`),
		...(category ? { category } : {}),
		...(folderPath ? { folderPath } : {})
	}
}

function parseListItems(value: ShareMigrationListItem[] | string, label: string): ShareMigrationListItem[] {
	const parsed = expectArray(parseJsonValue(value, label), label)
	return parsed.map((item, index) => parseListItem(item, `${label}[${index}]`))
}

function parseStorageRecord(value: unknown, label: string): ShareMigrationStorageRecord {
	const raw = expectRecord(value, label)
	const category = parseOptionalText(raw.category, `${label}.category`)
	const folderPath = parseCanonicalFolderPath(raw, label)
	return {
		name: expectString(raw.name, `${label}.name`),
		logo: expectString(raw.logo, `${label}.logo`),
		url: expectString(raw.url, `${label}.url`),
		description: expectString(raw.description, `${label}.description`),
		tags: parseTags(raw.tags, `${label}.tags`),
		stars: parseStars(raw.stars, `${label}.stars`),
		...(category ? { category } : {}),
		...(folderPath ? { folderPath } : {}),
		slug: parseSlug(raw.slug, `${label}.slug`),
		status: parseStatus(raw.status, `${label}.status`)
	}
}

function assertUniquePublishedStorageUrls(shares: Record<string, ShareMigrationStorageRecord>, label: string) {
	const seenUrls = new Set<string>()
	for (const record of Object.values(shares)) {
		if (record.status !== 'published') {
			continue
		}
		if (seenUrls.has(record.url)) {
			throw createDuplicateUrlError(label, record.url)
		}
		seenUrls.add(record.url)
	}
}

function parseStorage(value: ShareMigrationStorage | string, label: string): ShareMigrationStorage {
	const parsed = expectRecord(parseJsonValue(value, label), label)
	if (parsed.version !== 1) {
		throw createInvalidShapeError(`${label}.version`, '期望值 1')
	}
	if (hasOwn(parsed, 'updatedAt') && parsed.updatedAt !== undefined && typeof parsed.updatedAt !== 'string') {
		throw createInvalidShapeError(`${label}.updatedAt`, '期望字符串')
	}
	const shares = parsed.shares
	if (!isRecord(shares)) {
		throw createInvalidShapeError(`${label}.shares`, '期望对象')
	}
	const parsedShares = Object.fromEntries(
		Object.entries(shares).map(([key, record]) => [key, parseStorageRecord(record, `${label}.shares.${key}`)])
	) as Record<string, ShareMigrationStorageRecord>
	assertUniquePublishedStorageUrls(parsedShares, label)
	return {
		version: 1,
		...(typeof parsed.updatedAt === 'string' ? { updatedAt: parsed.updatedAt } : {}),
		shares: parsedShares
	}
}

function parseCategoryList(values: unknown[], label: string): string[] {
	return Array.from(
		new Set(values.map((value, index) => parseOptionalText(value, `${label}[${index}]`)).filter((item): item is string => Boolean(item)))
	).sort((left, right) => left.localeCompare(right))
}

function parseCategories(value: { categories?: unknown } | string, label: string): { categories: string[] } {
	const parsed = parseJsonValue(value, label)
	if (Array.isArray(parsed)) {
		return { categories: parseCategoryList(parsed, label) }
	}
	const raw = expectRecord(parsed, label)
	if (!Array.isArray(raw.categories)) {
		throw createInvalidShapeError(`${label}.categories`, '期望数组')
	}
	return {
		categories: parseCategoryList(raw.categories, `${label}.categories`)
	}
}

function parseFolderNode(value: unknown, label: string): BlogFolderNode {
	const raw = expectRecord(value, label)
	if (typeof raw.name !== 'string') {
		throw createInvalidShapeError(`${label}.name`, '期望字符串')
	}
	if (typeof raw.path !== 'string') {
		throw createInvalidShapeError(`${label}.path`, '期望字符串')
	}
	const path = normalizeFolderPath(raw.path)
	if (!path) {
		throw createInvalidShapeError(`${label}.path`, '期望非空文件夹路径')
	}
	const children = expectArray(raw.children, `${label}.children`)
	return {
		name: raw.name,
		path,
		children: children.map((child, index) => parseFolderNode(child, `${label}.children[${index}]`))
	}
}

function sortFolderNodes(nodes: BlogFolderNode[]): BlogFolderNode[] {
	return [...nodes]
		.map(node => ({
			name: node.name,
			path: node.path,
			children: sortFolderNodes(node.children)
		}))
		.sort((left, right) => left.path.localeCompare(right.path) || left.name.localeCompare(right.name))
}

function parseFolders(value: BlogFolderNode[] | string, label: string): BlogFolderNode[] {
	const parsed = expectArray(parseJsonValue(value, label), label)
	return sortFolderNodes(parsed.map((node, index) => parseFolderNode(node, `${label}[${index}]`)))
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

function assertUniqueListUrls(items: ShareMigrationListItem[], label: string) {
	const seenUrls = new Set<string>()
	for (const item of items) {
		if (seenUrls.has(item.url)) {
			throw createDuplicateUrlError(label, item.url)
		}
		seenUrls.add(item.url)
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

function toRuntimeArtifactsStorage(storage: ShareMigrationStorage): ShareStorageDB {
	return {
		version: 1,
		updatedAt: storage.updatedAt ?? RUNTIME_HELPER_UPDATED_AT,
		shares: Object.fromEntries(
			Object.entries(storage.shares).map(([key, record]) => [
				key,
				{
					name: record.name,
					logo: record.logo,
					url: record.url,
					description: record.description,
					tags: record.tags,
					stars: record.stars,
					...(record.category ? { category: record.category } : {}),
					...(record.folderPath ? { folderPath: record.folderPath } : {}),
					slug: record.slug,
					status: record.status
				}
			])
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
				.map(([key, record]) => [
					key,
					{
						name: record.name,
						logo: record.logo,
						url: record.url,
						description: record.description,
						tags: record.tags,
						stars: record.stars,
						...(record.category ? { category: record.category } : {}),
						...(record.folderPath ? { folderPath: record.folderPath } : {}),
						slug: record.slug,
						status: record.status
					}
				])
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
	assertUniqueListUrls(list, 'runtimeArtifacts.list')
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
	assertUniqueListUrls(runtimeList, 'list')
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
