import {
	applyCategorySelection,
	applyDirectorySelection,
	buildShareRuntimeSnapshot,
	SHARE_CATEGORY_ALL,
	SHARE_DIRECTORY_ALL,
	type ShareFolderNode,
	type ShareRuntimeFilters,
	type ShareRuntimeItem,
	type ShareRuntimeSnapshot
} from './share-runtime.ts'

export type ShareCategoriesArtifact = {
	categories: string[]
}

export type SharePageState = {
	artifacts: {
		list: ShareRuntimeItem[]
		categories: ShareCategoriesArtifact
		folders: ShareFolderNode[]
	}
	filters: ShareRuntimeFilters
	isEditMode: boolean
	runtime: ShareRuntimeSnapshot
}

function createDefaultFilters(overrides: Partial<ShareRuntimeFilters> = {}): ShareRuntimeFilters {
	return {
		activeDirectory: overrides.activeDirectory ?? SHARE_DIRECTORY_ALL,
		activeCategory: overrides.activeCategory ?? SHARE_CATEGORY_ALL,
		searchTerm: overrides.searchTerm ?? '',
		selectedTag: overrides.selectedTag ?? SHARE_CATEGORY_ALL
	}
}

function hasFolderPath(nodes: ShareFolderNode[], targetPath: string): boolean {
	return nodes.some(node => node.path === targetPath || hasFolderPath(node.children, targetPath))
}

function normalizeDirectoryFilter(activeDirectory: string, folders: ShareFolderNode[]): string {
	const normalizedDirectory = activeDirectory.trim()
	if (!normalizedDirectory || normalizedDirectory === SHARE_DIRECTORY_ALL) {
		return SHARE_DIRECTORY_ALL
	}

	return hasFolderPath(folders, normalizedDirectory) ? normalizedDirectory : SHARE_DIRECTORY_ALL
}

function normalizeCategoryFilter(activeCategory: string, categories: string[]): string {
	const normalizedCategory = activeCategory.trim()
	if (!normalizedCategory || normalizedCategory === SHARE_CATEGORY_ALL) {
		return SHARE_CATEGORY_ALL
	}

	return categories.includes(normalizedCategory) ? normalizedCategory : SHARE_CATEGORY_ALL
}

function normalizeSearchTerm(searchTerm: string): string {
	return searchTerm.trim()
}

function normalizeSelectedTag(selectedTag: string): string {
	const normalizedTag = selectedTag.trim()
	if (!normalizedTag || normalizedTag === SHARE_CATEGORY_ALL) {
		return SHARE_CATEGORY_ALL
	}

	return normalizedTag
}

function normalizeSharePageFilters(input: {
	artifacts: SharePageState['artifacts']
	filters: ShareRuntimeFilters
}): ShareRuntimeFilters {
	return {
		activeDirectory: normalizeDirectoryFilter(input.filters.activeDirectory, input.artifacts.folders),
		activeCategory: normalizeCategoryFilter(
			input.filters.activeCategory,
			input.artifacts.categories.categories
		),
		searchTerm: normalizeSearchTerm(input.filters.searchTerm),
		selectedTag: normalizeSelectedTag(input.filters.selectedTag)
	}
}

function buildSharePageRuntime(input: {
	listArtifact: ShareRuntimeItem[]
	categoriesArtifact: ShareCategoriesArtifact
	foldersArtifact: ShareFolderNode[]
	filters: ShareRuntimeFilters
}): ShareRuntimeSnapshot {
	return buildShareRuntimeSnapshot({
		items: input.listArtifact,
		categories: input.categoriesArtifact.categories,
		folders: input.foldersArtifact,
		filters: input.filters
	})
}

function ensureCategoryCandidate(categories: string[], activeCategory: string): string[] {
	if (!activeCategory || activeCategory === SHARE_CATEGORY_ALL || categories.includes(activeCategory)) {
		return categories
	}
	return [...categories, activeCategory]
}

function ensureFolderPathInTree(nodes: ShareFolderNode[], activeDirectory: string): ShareFolderNode[] {
	if (!activeDirectory || activeDirectory === SHARE_DIRECTORY_ALL) {
		return nodes
	}

	const parts = activeDirectory.split('/').filter(Boolean)
	if (parts.length === 0) {
		return nodes
	}

	const insertNode = (items: ShareFolderNode[], depth: number, currentPath: string): ShareFolderNode[] => {
		const name = parts[depth]
		const path = `${currentPath}/${name}`
		const nextItems = [...items]
		let index = nextItems.findIndex(node => node.path === path)

		if (index === -1) {
			nextItems.push({ name, path, children: [] })
			nextItems.sort((left, right) => left.path.localeCompare(right.path))
			index = nextItems.findIndex(node => node.path === path)
		}

		if (depth < parts.length - 1) {
			const node = nextItems[index]
			nextItems[index] = {
				...node,
				children: insertNode(node.children, depth + 1, path)
			}
		}

		return nextItems
	}

	return insertNode(nodes, 0, '')
}

function rebuildSharePageState(input: {
	artifacts: SharePageState['artifacts']
	filters: ShareRuntimeFilters
	isEditMode: boolean
	preserveFilters?: boolean
}): SharePageState {
	const filters = input.preserveFilters
		? input.filters
		: normalizeSharePageFilters({
				artifacts: input.artifacts,
				filters: input.filters
			})
	const runtimeArtifacts = input.preserveFilters
		? {
				list: input.artifacts.list,
				categories: {
					categories: ensureCategoryCandidate(input.artifacts.categories.categories, filters.activeCategory)
				},
				folders: ensureFolderPathInTree(input.artifacts.folders, filters.activeDirectory)
			}
		: input.artifacts
	const runtime = buildSharePageRuntime({
		listArtifact: runtimeArtifacts.list,
		categoriesArtifact: runtimeArtifacts.categories,
		foldersArtifact: runtimeArtifacts.folders,
		filters
	})

	return {
		artifacts: input.artifacts,
		filters,
		isEditMode: input.isEditMode,
		runtime: input.preserveFilters
			? {
					...runtime,
					directoryTree: ensureFolderPathInTree(runtime.directoryTree, filters.activeDirectory)
				}
			: runtime
	}
}

export function createSharePageState(input: {
	listArtifact: ShareRuntimeItem[]
	categoriesArtifact: ShareCategoriesArtifact
	foldersArtifact: ShareFolderNode[]
	filters?: Partial<ShareRuntimeFilters>
	isEditMode?: boolean
}): SharePageState {
	return rebuildSharePageState({
		artifacts: {
			list: input.listArtifact,
			categories: input.categoriesArtifact,
			folders: input.foldersArtifact
		},
		filters: createDefaultFilters(input.filters),
		isEditMode: input.isEditMode ?? false
	})
}

export function replaceSharePageArtifacts(
	state: SharePageState,
	nextArtifacts: {
		listArtifact: ShareRuntimeItem[]
		categoriesArtifact: ShareCategoriesArtifact
		foldersArtifact: ShareFolderNode[]
	},
	options: {
		preserveFilters?: boolean
	} = {}
): SharePageState {
	return rebuildSharePageState({
		artifacts: {
			list: nextArtifacts.listArtifact,
			categories: nextArtifacts.categoriesArtifact,
			folders: nextArtifacts.foldersArtifact
		},
		filters: state.filters,
		isEditMode: state.isEditMode,
		preserveFilters: options.preserveFilters
	})
}

export function startShareEditSession(editingAnchorUrls: string[], url: string, renamedUrls?: Map<string, string>): string[] {
	const anchorUrl = resolveShareEditAnchorUrl(url, renamedUrls)
	return editingAnchorUrls.includes(anchorUrl) ? editingAnchorUrls : [...editingAnchorUrls, anchorUrl]
}

export function finishShareEditSession(editingAnchorUrls: string[], url: string, renamedUrls?: Map<string, string>): string[] {
	const anchorUrl = resolveShareEditAnchorUrl(url, renamedUrls)
	return editingAnchorUrls.filter(currentAnchorUrl => currentAnchorUrl !== anchorUrl)
}

export function setSharePageDirectory(state: SharePageState, nextDirectory: string): SharePageState {
	return rebuildSharePageState({
		artifacts: state.artifacts,
		filters: applyDirectorySelection({
			items: state.artifacts.list,
			categories: state.artifacts.categories.categories,
			folders: state.artifacts.folders,
			current: state.filters,
			nextDirectory
		}),
		isEditMode: state.isEditMode
	})
}

export function setSharePageCategory(state: SharePageState, nextCategory: string): SharePageState {
	return rebuildSharePageState({
		artifacts: state.artifacts,
		filters: applyCategorySelection({
			items: state.artifacts.list,
			categories: state.artifacts.categories.categories,
			current: state.filters,
			nextCategory
		}),
		isEditMode: state.isEditMode
	})
}

export function setSharePageSearchTerm(state: SharePageState, nextSearchTerm: string): SharePageState {
	return rebuildSharePageState({
		artifacts: state.artifacts,
		filters: {
			...state.filters,
			searchTerm: nextSearchTerm
		},
		isEditMode: state.isEditMode
	})
}

export function setSharePageSelectedTag(state: SharePageState, nextSelectedTag: string): SharePageState {
	return rebuildSharePageState({
		artifacts: state.artifacts,
		filters: {
			...state.filters,
			selectedTag: nextSelectedTag
		},
		isEditMode: state.isEditMode
	})
}

export function setSharePageEditMode(state: SharePageState, isEditMode: boolean): SharePageState {
	return rebuildSharePageState({
		artifacts: state.artifacts,
		filters: state.filters,
		isEditMode
	})
}

export function resolveShareEditAnchorUrl(currentUrl: string, renamedUrls?: Map<string, string>): string {
	return renamedUrls?.get(currentUrl) ?? currentUrl
}

export function mergeEditingSharesIntoVisibleItems(params: {
	visibleItems: ShareRuntimeItem[]
	allItems: ShareRuntimeItem[]
	editingAnchorUrls: string[]
	renamedUrls?: Map<string, string>
}): ShareRuntimeItem[] {
	if (params.editingAnchorUrls.length === 0) {
		return params.visibleItems
	}

	const targetAnchorUrls = new Set<string>(params.editingAnchorUrls)
	for (const item of params.visibleItems) {
		targetAnchorUrls.add(resolveShareEditAnchorUrl(item.url, params.renamedUrls))
	}

	const mergedItems: ShareRuntimeItem[] = []
	const addedAnchorUrls = new Set<string>()
	for (const item of params.allItems) {
		const anchorUrl = resolveShareEditAnchorUrl(item.url, params.renamedUrls)
		if (!targetAnchorUrls.has(anchorUrl) || addedAnchorUrls.has(anchorUrl)) {
			continue
		}
		mergedItems.push(item)
		addedAnchorUrls.add(anchorUrl)
	}

	return mergedItems
}

export function createHomeShareListContract(listArtifact: ShareRuntimeItem[]): ShareRuntimeItem[] {
	return listArtifact
}
