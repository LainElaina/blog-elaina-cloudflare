import type { BlogIndexItem } from './types'

export const BLOG_FOLDER_ALL = '__all__'
export const BLOG_FOLDER_UNFILED = '__unfiled__'

export type BlogFilterParams = {
	favoritesOnly: boolean
	folderPath: string
}

export type BlogDisplayMode = 'day' | 'week' | 'month' | 'year' | 'category' | 'folder'

export type FolderGroupResult = {
	groupedItems: Record<string, { items: BlogIndexItem[]; label: string }>
	groupKeys: string[]
	getGroupLabel: (key: string) => string
}

function normalizeFolderPath(folderPath?: string): string | undefined {
	const value = folderPath?.trim()
	if (!value) return undefined
	const parts = value
		.split('/')
		.map(item => item.trim())
		.filter(Boolean)
	if (parts.length === 0) return undefined
	return `/${parts.join('/')}`
}

export function filterBlogItems(items: BlogIndexItem[], params: BlogFilterParams): BlogIndexItem[] {
	const { favoritesOnly, folderPath } = params
	return items.filter(item => {
		if (favoritesOnly && item.favorite !== true) return false

		if (folderPath === BLOG_FOLDER_ALL) return true
		const normalized = normalizeFolderPath(item.folderPath)
		if (folderPath === BLOG_FOLDER_UNFILED) {
			return !normalized
		}
		return normalized === folderPath
	})
}

export function getFilteredDisplayItems(
	items: BlogIndexItem[],
	params: {
		favoritesOnly: boolean
		activeFolderPath: string
		displayMode: BlogDisplayMode
	}
): BlogIndexItem[] {
	return filterBlogItems(items, {
		favoritesOnly: params.favoritesOnly,
		folderPath: params.displayMode === 'folder' ? params.activeFolderPath : BLOG_FOLDER_ALL
	})
}

export function buildFolderGroups(items: BlogIndexItem[]): FolderGroupResult {
	const groupedItems: Record<string, { items: BlogIndexItem[]; label: string }> = {}

	for (const item of items) {
		const normalized = normalizeFolderPath(item.folderPath)
		const key = normalized ?? BLOG_FOLDER_UNFILED
		const label = normalized ?? '未归档'
		if (!groupedItems[key]) {
			groupedItems[key] = { items: [], label }
		}
		groupedItems[key].items.push(item)
	}

	const groupKeys = Object.keys(groupedItems).sort((a, b) => {
		if (a === BLOG_FOLDER_UNFILED) return 1
		if (b === BLOG_FOLDER_UNFILED) return -1
		return a.localeCompare(b)
	})

	return {
		groupedItems,
		groupKeys,
		getGroupLabel: (key: string) => groupedItems[key]?.label || key
	}
}

export function retainSelectionInView(selectedSlugs: Set<string>, visibleItems: BlogIndexItem[]): Set<string> {
	if (selectedSlugs.size === 0) return selectedSlugs
	const visibleSlugs = new Set(visibleItems.map(item => item.slug))
	const next = new Set<string>()
	for (const slug of selectedSlugs) {
		if (visibleSlugs.has(slug)) {
			next.add(slug)
		}
	}
	return next
}

export function assignFolderPath(items: BlogIndexItem[], selectedSlugs: Set<string>, nextFolderPath?: string): BlogIndexItem[] {
	const normalized = normalizeFolderPath(nextFolderPath)
	return items.map(item => {
		if (!selectedSlugs.has(item.slug)) return item
		if (!normalized) return { ...item, folderPath: undefined }
		return { ...item, folderPath: normalized }
	})
}

export function collectFolderPaths(items: BlogIndexItem[], existingFolders: string[]): string[] {
	const merged = new Set<string>()
	for (const folder of existingFolders) {
		const normalized = normalizeFolderPath(folder)
		if (normalized) merged.add(normalized)
	}
	for (const item of items) {
		const normalized = normalizeFolderPath(item.folderPath)
		if (normalized) merged.add(normalized)
	}
	return Array.from(merged).sort((a, b) => a.localeCompare(b))
}

export function formatFolderOptionLabel(path: string): string {
	const depth = path.split('/').filter(Boolean).length
	return `${'　'.repeat(Math.max(0, depth - 1))}${path}`
}
