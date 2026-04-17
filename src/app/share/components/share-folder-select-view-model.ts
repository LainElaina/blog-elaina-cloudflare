import { buildBlogFolderTree } from '@/lib/content-db/blog-folders'
import type { ShareCategoriesArtifact } from '../share-page-state'
import type { ShareFolderNode, ShareRuntimeItem } from '../share-runtime'

export type ShareFolderSelectOption = {
	value: string
	label: string
}

export type ShareFolderSelectViewModel = {
	options: ShareFolderSelectOption[]
	emptyMessage: string | null
	createButtonLabel: string
	nextValueAfterCreate?: string
}

export type ShareEditSubmitPayload<TShare extends { url: string }, TLogoItem = never> = {
	share: TShare
	oldUrl?: string
	currentUrl: string
	logoItem?: TLogoItem
}

export type ShareUrlMapping = {
	oldUrl: string
	currentUrl: string
}

export type ShareRuntimeArtifacts = {
	categories: ShareCategoriesArtifact
	folders: ShareFolderNode[]
}

export function normalizeShareUrlInput(input: string): string {
	return input.trim()
}

export function normalizeShareFolderPathInput(input?: string): string | undefined {
	const value = input?.trim()
	if (!value) {
		return undefined
	}

	const parts = value
		.split('/')
		.map(item => item.trim())
		.filter(Boolean)

	if (parts.length === 0) {
		return undefined
	}

	return `/${parts.join('/')}`
}

function createFolderOption(value: string): ShareFolderSelectOption {
	return {
		value,
		label: value || '默认目录'
	}
}

export function collectShareFolderPaths(nodes: ShareFolderNode[]): string[] {
	const folders: string[] = []
	const seen = new Set<string>()

	const visit = (items: ShareFolderNode[]) => {
		for (const item of items) {
			const normalizedPath = normalizeShareFolderPathInput(item.path)
			if (normalizedPath && !seen.has(normalizedPath)) {
				seen.add(normalizedPath)
				folders.push(normalizedPath)
			}
			visit(item.children)
		}
	}

	visit(nodes)
	return folders
}

export function buildShareRuntimeArtifactsFromList(
	items: Array<Pick<ShareRuntimeItem, 'category' | 'folderPath'>>
): ShareRuntimeArtifacts {
	const categories = Array.from(
		new Set(items.map(item => normalizeShareCategoryInput(item.category ?? '')).filter((value): value is string => Boolean(value)))
	).sort((left, right) => left.localeCompare(right))

	return {
		categories: { categories },
		folders: buildBlogFolderTree(items.map(item => normalizeShareFolderPathInput(item.folderPath)))
	}
}

export function buildShareFolderSelectViewModel(params: {
	folders: string[]
	value: string
	createdFolderInput?: string
}): ShareFolderSelectViewModel {
	const nextValueAfterCreate = normalizeShareFolderPathInput(params.createdFolderInput)
	const currentValue = normalizeShareFolderPathInput(params.value) ?? ''
	const optionValues = ['']
	const seen = new Set(optionValues)

	for (const folder of params.folders) {
		const normalizedFolder = normalizeShareFolderPathInput(folder)
		if (!normalizedFolder || seen.has(normalizedFolder)) {
			continue
		}
		seen.add(normalizedFolder)
		optionValues.push(normalizedFolder)
	}

	for (const pendingValue of [nextValueAfterCreate, currentValue]) {
		if (!pendingValue || seen.has(pendingValue)) {
			continue
		}
		seen.add(pendingValue)
		optionValues.push(pendingValue)
	}

	return {
		options: optionValues.map(createFolderOption),
		emptyMessage: optionValues.length === 1 ? '暂无目录，请先新建目录' : null,
		createButtonLabel: '新建目录',
		...(nextValueAfterCreate ? { nextValueAfterCreate } : {})
	}
}

export function buildShareEditSubmitPayload<TShare extends { url: string }, TLogoItem = never>(params: {
	share: TShare
	oldUrl?: string
	logoItem?: TLogoItem
}): ShareEditSubmitPayload<TShare, TLogoItem> {
	const currentUrl = normalizeShareUrlInput(params.share.url)
	const oldUrl = params.oldUrl ? normalizeShareUrlInput(params.oldUrl) || undefined : undefined

	return {
		share: { ...params.share, url: currentUrl },
		oldUrl,
		currentUrl,
		...(params.logoItem !== undefined ? { logoItem: params.logoItem } : {})
	}
}

export function updatePendingShareUrlMappings(
	next: Map<string, string>,
	params: { oldUrl?: string; currentUrl?: string }
): Map<string, string> {
	const oldUrl = params.oldUrl ? normalizeShareUrlInput(params.oldUrl) : undefined
	const currentUrl = params.currentUrl ? normalizeShareUrlInput(params.currentUrl) : undefined
	if (!oldUrl || !currentUrl || oldUrl === currentUrl) {
		return next
	}

	const baseUrl = next.get(oldUrl) ?? oldUrl
	next.delete(oldUrl)
	if (currentUrl !== baseUrl) {
		next.set(currentUrl, baseUrl)
	}
	return next
}

export function migratePendingShareLogoItems<T>(
	next: Map<string, T>,
	params: { oldUrl?: string; currentUrl: string; logoItem?: T }
): Map<string, T> {
	const oldUrl = params.oldUrl ? normalizeShareUrlInput(params.oldUrl) : undefined
	const currentUrl = normalizeShareUrlInput(params.currentUrl)

	if (params.logoItem !== undefined) {
		if (oldUrl && oldUrl !== currentUrl) {
			next.delete(oldUrl)
		}
		next.set(currentUrl, params.logoItem)
		return next
	}

	if (!oldUrl || oldUrl === currentUrl) {
		return next
	}

	const existingLogoItem = next.get(oldUrl)
	next.delete(oldUrl)
	if (existingLogoItem !== undefined) {
		next.set(currentUrl, existingLogoItem)
	}
	return next
}

export function normalizeShareCategoryInput(input: string): string | undefined {
	const normalized = input.trim()
	return normalized || undefined
}
