export const SHARE_DIRECTORY_ALL = 'all'
export const SHARE_CATEGORY_ALL = 'all'

export type ShareRuntimeItem = {
	name: string
	logo: string
	url: string
	description: string
	tags: string[]
	stars: number
	category?: string
	folderPath?: string
}

export type ShareFolderNode = {
	name: string
	path: string
	children: ShareFolderNode[]
}

export function normalizeShareRuntimeItems(items: unknown): ShareRuntimeItem[] {
	if (!Array.isArray(items)) {
		return []
	}

	return items.flatMap(item => {
		if (!item || typeof item !== 'object' || Array.isArray(item)) {
			return []
		}

		const share = item as Record<string, unknown>
		if (
			typeof share.name !== 'string' ||
			typeof share.logo !== 'string' ||
			typeof share.url !== 'string' ||
			typeof share.description !== 'string' ||
			!Array.isArray(share.tags) ||
			!share.tags.every(tag => typeof tag === 'string') ||
			!Number.isFinite(share.stars)
		) {
			return []
		}

		const { category, folderPath, ...shareFields } = share
		return [
			{
				...shareFields,
				name: share.name,
				logo: share.logo,
				url: share.url,
				description: share.description,
				tags: share.tags,
				stars: share.stars,
				...(typeof category === 'string' ? { category } : {}),
				...(typeof folderPath === 'string' ? { folderPath } : {})
			} as ShareRuntimeItem
		]
	})
}

export function normalizeShareRuntimeCategories(categories: unknown): string[] {
	if (!Array.isArray(categories)) {
		return []
	}

	return categories.filter(category => typeof category === 'string')
}

export function normalizeShareFolderNodes(nodes: unknown): ShareFolderNode[] {
	if (!Array.isArray(nodes)) {
		return []
	}

	return nodes.flatMap(node => {
		if (!node || typeof node !== 'object' || Array.isArray(node)) {
			return []
		}

		const folder = node as Record<string, unknown>
		if (typeof folder.name !== 'string' || typeof folder.path !== 'string') {
			return []
		}

		return [
			{
				name: folder.name,
				path: folder.path,
				children: normalizeShareFolderNodes(folder.children)
			}
		]
	})
}

export type ShareRuntimeFilters = {
	activeDirectory: string
	activeCategory: string
	searchTerm: string
	selectedTag: string
}

export type ShareRuntimeSnapshot = {
	visibleItems: ShareRuntimeItem[]
	availableCategories: string[]
	directoryTree: ShareFolderNode[]
	activeCategory: string
	emptyState: 'directory-empty' | 'category-empty' | 'filter-empty' | 'global-empty' | null
}

function matchesSearch(item: ShareRuntimeItem, searchTerm: string): boolean {
	const normalizedSearch = searchTerm.trim().toLowerCase()
	if (!normalizedSearch) {
		return true
	}

	return (
		item.name.toLowerCase().includes(normalizedSearch) ||
		item.description.toLowerCase().includes(normalizedSearch)
	)
}

function matchesTag(item: ShareRuntimeItem, selectedTag: string): boolean {
	return selectedTag === SHARE_CATEGORY_ALL || item.tags.includes(selectedTag)
}

function isWithinDirectory(item: ShareRuntimeItem, activeDirectory: string): boolean {
	if (activeDirectory === SHARE_DIRECTORY_ALL) {
		return true
	}

	if (!item.folderPath) {
		return false
	}

	return item.folderPath === activeDirectory || item.folderPath.startsWith(`${activeDirectory}/`)
}

function filterItemsByDirectory(items: ShareRuntimeItem[], activeDirectory: string): ShareRuntimeItem[] {
	return items.filter(item => isWithinDirectory(item, activeDirectory))
}

function filterItemsByCategory(items: ShareRuntimeItem[], activeCategory: string): ShareRuntimeItem[] {
	if (activeCategory === SHARE_CATEGORY_ALL) {
		return items
	}

	return items.filter(item => item.category === activeCategory)
}

function getAvailableCategories(items: ShareRuntimeItem[], categories: string[]): string[] {
	return [
		SHARE_CATEGORY_ALL,
		...categories.filter(category => items.some(item => item.category === category))
	]
}

function folderHasShares(items: ShareRuntimeItem[], folderPath: string): boolean {
	return items.some(
		item => item.folderPath === folderPath || item.folderPath?.startsWith(`${folderPath}/`)
	)
}

function pruneEmptyFolders(nodes: ShareFolderNode[], items: ShareRuntimeItem[]): ShareFolderNode[] {
	return nodes.flatMap(node => {
		const children = pruneEmptyFolders(node.children, items)
		if (!folderHasShares(items, node.path) && children.length === 0) {
			return []
		}

		return [{ ...node, children }]
	})
}

function hasFolderPath(nodes: ShareFolderNode[], targetPath: string): boolean {
	return nodes.some(node => node.path === targetPath || hasFolderPath(node.children, targetPath))
}

function normalizeDirectorySelection(nextDirectory: string, folders: ShareFolderNode[]): string {
	const normalizedDirectory = nextDirectory.trim()
	if (!normalizedDirectory || normalizedDirectory === SHARE_DIRECTORY_ALL) {
		return SHARE_DIRECTORY_ALL
	}

	return hasFolderPath(folders, normalizedDirectory) ? normalizedDirectory : SHARE_DIRECTORY_ALL
}

function normalizeCategoryInput(nextCategory: string, categories: string[]): string {
	const normalizedCategory = nextCategory.trim()
	if (!normalizedCategory || normalizedCategory === SHARE_CATEGORY_ALL) {
		return SHARE_CATEGORY_ALL
	}

	return categories.includes(normalizedCategory) ? normalizedCategory : SHARE_CATEGORY_ALL
}

function normalizeCategorySelection(nextCategory: string, items: ShareRuntimeItem[], categories: string[]): string {
	const normalizedCategory = normalizeCategoryInput(nextCategory, categories)
	if (normalizedCategory === SHARE_CATEGORY_ALL) {
		return SHARE_CATEGORY_ALL
	}

	return getAvailableCategories(items, categories).includes(normalizedCategory)
		? normalizedCategory
		: SHARE_CATEGORY_ALL
}

export function buildShareRuntimeSnapshot(input: {
	items: ShareRuntimeItem[]
	categories: string[]
	folders: ShareFolderNode[]
	filters: ShareRuntimeFilters
}): ShareRuntimeSnapshot {
	const items = normalizeShareRuntimeItems(input.items)
	const categories = normalizeShareRuntimeCategories(input.categories)
	const folders = normalizeShareFolderNodes(input.folders)
	const activeDirectory = normalizeDirectorySelection(input.filters.activeDirectory, folders)
	const directoryItems = filterItemsByDirectory(items, activeDirectory)
	const activeCategory = normalizeCategoryInput(input.filters.activeCategory, categories)
	const categoryItems = filterItemsByCategory(directoryItems, activeCategory)
	const visibleItems = categoryItems.filter(
		item => matchesSearch(item, input.filters.searchTerm) && matchesTag(item, input.filters.selectedTag)
	)

	let emptyState: ShareRuntimeSnapshot['emptyState'] = null
	if (items.length === 0) {
		emptyState = 'global-empty'
	} else if (directoryItems.length === 0) {
		emptyState = 'directory-empty'
	} else if (categoryItems.length === 0) {
		emptyState = 'category-empty'
	} else if (visibleItems.length === 0) {
		emptyState = 'filter-empty'
	}

	return {
		visibleItems,
		availableCategories: getAvailableCategories(directoryItems, categories),
		directoryTree: pruneEmptyFolders(folders, items),
		activeCategory,
		emptyState
	}
}

export function applyDirectorySelection(input: {
	items: ShareRuntimeItem[]
	categories: string[]
	folders: ShareFolderNode[]
	current: ShareRuntimeFilters
	nextDirectory: string
}): ShareRuntimeFilters {
	const items = normalizeShareRuntimeItems(input.items)
	const categories = normalizeShareRuntimeCategories(input.categories)
	const activeDirectory = normalizeDirectorySelection(input.nextDirectory, normalizeShareFolderNodes(input.folders))
	const nextDirectoryItems = filterItemsByDirectory(items, activeDirectory)
	const activeCategory = normalizeCategorySelection(
		input.current.activeCategory,
		nextDirectoryItems,
		categories
	)

	return {
		...input.current,
		activeDirectory,
		activeCategory
	}
}

export function applyCategorySelection(input: {
	items: ShareRuntimeItem[]
	categories: string[]
	current: ShareRuntimeFilters
	nextCategory: string
}): ShareRuntimeFilters {
	const currentDirectoryItems = filterItemsByDirectory(
		normalizeShareRuntimeItems(input.items),
		input.current.activeDirectory
	)

	return {
		...input.current,
		activeCategory: normalizeCategorySelection(
			input.nextCategory,
			currentDirectoryItems,
			normalizeShareRuntimeCategories(input.categories)
		)
	}
}
