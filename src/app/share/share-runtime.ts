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
	const activeDirectory = normalizeDirectorySelection(input.filters.activeDirectory, input.folders)
	const directoryItems = filterItemsByDirectory(input.items, activeDirectory)
	const activeCategory = normalizeCategoryInput(input.filters.activeCategory, input.categories)
	const categoryItems = filterItemsByCategory(directoryItems, activeCategory)
	const visibleItems = categoryItems.filter(
		item => matchesSearch(item, input.filters.searchTerm) && matchesTag(item, input.filters.selectedTag)
	)

	let emptyState: ShareRuntimeSnapshot['emptyState'] = null
	if (input.items.length === 0) {
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
		availableCategories: getAvailableCategories(directoryItems, input.categories),
		directoryTree: pruneEmptyFolders(input.folders, input.items),
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
	const activeDirectory = normalizeDirectorySelection(input.nextDirectory, input.folders)
	const nextDirectoryItems = filterItemsByDirectory(input.items, activeDirectory)
	const activeCategory = normalizeCategorySelection(
		input.current.activeCategory,
		nextDirectoryItems,
		input.categories
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
	const currentDirectoryItems = filterItemsByDirectory(input.items, input.current.activeDirectory)

	return {
		...input.current,
		activeCategory: normalizeCategorySelection(
			input.nextCategory,
			currentDirectoryItems,
			input.categories
		)
	}
}
