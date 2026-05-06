type RebuildContractResult = {
	artifacts: {
		index: string
		categories: string
		folders: string
		storage: string
	}
	touchesMarkdown: false
	touchesImages: false
	atomic: true
}

type VerifyContractResult = {
	artifactsToRebuild: string[]
	touchesMarkdown: false
	touchesImages: false
	atomic: true
}

type SyncContractResult = {
	storageRaw: string
	touchesMarkdown: false
	touchesImages: false
	atomic: true
}

type BlogStatus = 'published' | 'draft' | 'archived'

type BlogStorageRecord = {
	slug: string
	title: string
	tags: string[]
	date: string
	summary?: string
	cover?: string
	hidden?: boolean
	category?: string
	folderPath?: string
	favorite?: boolean
	status: BlogStatus
}

type BlogStorageDB = {
	version: 1
	updatedAt: string
	blogs: Record<string, BlogStorageRecord>
}

type BlogFolderNode = {
	name: string
	path: string
	children: BlogFolderNode[]
}

type BlogIndexItem = {
	slug: string
	title: string
	tags: string[]
	date: string
	summary?: string
	cover?: string
	hidden?: boolean
	category?: string
	folderPath?: string
	favorite?: boolean
}

function normalizeFolderPath(input: string): string {
	const parts = input
		.split('/')
		.map(part => part.trim())
		.filter(Boolean)
	return `/${parts.join('/')}`
}

function parseBlogStorageDB(raw: string): BlogStorageDB {
	const parsed = JSON.parse(raw) as BlogStorageDB
	return {
		version: 1,
		updatedAt: parsed.updatedAt,
		blogs: parsed.blogs ?? {}
	}
}

function parseBlogIndexItems(raw: string): BlogIndexItem[] {
	const parsed = JSON.parse(raw) as BlogIndexItem[]
	return Array.isArray(parsed) ? parsed : []
}

function insertIntoTree(nodes: BlogFolderNode[], parts: string[], currentPath = ''): BlogFolderNode[] {
	if (parts.length === 0) return nodes
	const [head, ...rest] = parts
	const path = `${currentPath}/${head}`
	const existing = nodes.find(node => node.name === head)
	if (existing) {
		existing.children = insertIntoTree(existing.children, rest, path)
		return nodes
	}
	const nextNode: BlogFolderNode = {
		name: head,
		path,
		children: insertIntoTree([], rest, path)
	}
	return [...nodes, nextNode].sort((a, b) => a.path.localeCompare(b.path))
}

function buildBlogFolderTree(folderPaths: Array<string | undefined>): BlogFolderNode[] {
	let tree: BlogFolderNode[] = []
	for (const rawPath of folderPaths) {
		if (!rawPath) continue
		const normalized = normalizeFolderPath(rawPath)
		const parts = normalized.split('/').filter(Boolean)
		tree = insertIntoTree(tree, parts)
	}
	return tree
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

function parseCategoriesArtifact(raw: string): { categories: string[] } {
	const parsed = JSON.parse(raw) as { categories?: unknown }
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !Array.isArray(parsed.categories)) {
		throw new Error('invalid blog categories artifact')
	}
	return {
		categories: Array.from(new Set(parsed.categories.filter((category): category is string => typeof category === 'string'))).sort((a, b) =>
			a.localeCompare(b)
		)
	}
}

function sortFolderNodes(nodes: BlogFolderNode[]): BlogFolderNode[] {
	return [...nodes]
		.map(node => ({
			name: node.name,
			path: normalizeFolderPath(node.path),
			children: sortFolderNodes(Array.isArray(node.children) ? node.children : [])
		}))
		.sort((left, right) => left.path.localeCompare(right.path) || left.name.localeCompare(right.name))
}

function parseFoldersArtifact(raw: string): BlogFolderNode[] {
	const parsed = JSON.parse(raw) as unknown
	if (!Array.isArray(parsed)) {
		throw new Error('invalid blog folders artifact')
	}
	return sortFolderNodes(parsed as BlogFolderNode[])
}

function parseStorageArtifact(raw: string): BlogStorageDB {
	return parseBlogStorageDB(raw)
}

function artifactsAreEquivalent(left: unknown, right: unknown): boolean {
	return stringifyStable(left) === stringifyStable(right)
}

export function syncBlogRuntimeArtifactsToLedger(params: {
	indexRaw: string
	storageRaw: string | null
}): SyncContractResult {
	const indexItems = parseBlogIndexItems(params.indexRaw)
	const baseStorage = params.storageRaw ? parseBlogStorageDB(params.storageRaw) : { version: 1 as const, updatedAt: new Date().toISOString(), blogs: {} }
	const blogs: Record<string, BlogStorageRecord> = Object.fromEntries(
		Object.entries(baseStorage.blogs).filter(([, record]) => record.status !== 'published')
	)

	for (const item of indexItems) {
		blogs[item.slug] = {
			slug: item.slug,
			title: item.title,
			tags: Array.isArray(item.tags) ? item.tags : [],
			date: item.date,
			summary: item.summary,
			cover: item.cover,
			hidden: item.hidden,
			category: item.category,
			folderPath: item.folderPath,
			favorite: item.favorite ?? false,
			status: 'published'
		}
	}

	return {
		storageRaw: JSON.stringify(
			{
				version: 1,
				updatedAt: baseStorage.updatedAt,
				blogs
			},
			null,
			2
		),
		touchesMarkdown: false,
		touchesImages: false,
		atomic: true
	}
}

export function rebuildBlogRuntimeArtifactsFromStorage(storageRaw: string): RebuildContractResult {
	const db = parseBlogStorageDB(storageRaw)
	const records = Object.values(db.blogs)
		.filter(record => record.status === 'published')
		.sort((a, b) => (b.date || '').localeCompare(a.date || ''))

	const index = records.map(record => ({
		slug: record.slug,
		title: record.title,
		tags: record.tags,
		date: record.date,
		summary: record.summary,
		cover: record.cover,
		hidden: record.hidden,
		category: record.category,
		folderPath: record.folderPath,
		favorite: record.favorite ?? false
	}))

	const categories = Array.from(new Set(records.map(record => record.category).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b))
	const folders = buildBlogFolderTree(records.map(record => record.folderPath))

	return {
		artifacts: {
			index: JSON.stringify(index, null, 2),
			categories: JSON.stringify({ categories }, null, 2),
			folders: JSON.stringify(folders, null, 2),
			storage: JSON.stringify(db, null, 2)
		},
		touchesMarkdown: false,
		touchesImages: false,
		atomic: true
	}
}

export function verifyBlogLedgerAgainstRuntime(params: {
	storageRaw: string
	runtimeArtifacts: {
		index: string
		categories: string
		folders: string
		storage: string
	}
}): VerifyContractResult {
	const rebuilt = rebuildBlogRuntimeArtifactsFromStorage(params.storageRaw)
	const artifactsToRebuild: string[] = []

	if (!artifactsAreEquivalent(parseBlogIndexItems(params.runtimeArtifacts.index), parseBlogIndexItems(rebuilt.artifacts.index))) {
		artifactsToRebuild.push('public/blogs/index.json')
	}
	if (!artifactsAreEquivalent(parseCategoriesArtifact(params.runtimeArtifacts.categories), parseCategoriesArtifact(rebuilt.artifacts.categories))) {
		artifactsToRebuild.push('public/blogs/categories.json')
	}
	if (!artifactsAreEquivalent(parseFoldersArtifact(params.runtimeArtifacts.folders), parseFoldersArtifact(rebuilt.artifacts.folders))) {
		artifactsToRebuild.push('public/blogs/folders.json')
	}
	if (!artifactsAreEquivalent(parseStorageArtifact(params.runtimeArtifacts.storage), parseStorageArtifact(rebuilt.artifacts.storage))) {
		artifactsToRebuild.push('public/blogs/storage.json')
	}

	return {
		artifactsToRebuild,
		touchesMarkdown: false,
		touchesImages: false,
		atomic: true
	}
}
