import type { BlogIndexItem } from './types'

type BlogFolderNodeLike = {
	path: string
	children?: BlogFolderNodeLike[]
}

export type BlogSaveBaseline = {
	items: BlogIndexItem[]
	categories: string[]
	folders: string[]
}

export function normalizeCategoryList(list: string[]): string[] {
	return list.map(c => c.trim()).filter(Boolean)
}

function flattenBlogFolderPaths(nodes: BlogFolderNodeLike[]): string[] {
	const paths: string[] = []
	const visit = (node: BlogFolderNodeLike) => {
		paths.push(node.path)
		for (const child of node.children ?? []) {
			visit(child)
		}
	}
	for (const node of nodes) {
		visit(node)
	}
	return paths
}

export function buildBlogSaveBaseline(artifacts: { index: BlogIndexItem[]; categories: string[]; folders: BlogFolderNodeLike[] }): BlogSaveBaseline {
	return {
		items: artifacts.index,
		categories: artifacts.categories,
		folders: flattenBlogFolderPaths(artifacts.folders)
	}
}

export function hasBlogSaveChanges(params: {
	items: BlogIndexItem[]
	editableItems: BlogIndexItem[]
	categoryList: string[]
	categoriesFromServer: string[]
}): boolean {
	const { items, editableItems, categoryList, categoriesFromServer } = params
	const removedSlugs = items.filter(item => !editableItems.some(editItem => editItem.slug === item.slug)).map(item => item.slug)
	const normalizedCategoryList = normalizeCategoryList(categoryList)
	const categoryListChanged = JSON.stringify(normalizedCategoryList) !== JSON.stringify(normalizeCategoryList(categoriesFromServer || []))
	const metadataChanged = items.some(origin => {
		const next = editableItems.find(editItem => editItem.slug === origin.slug)
		const originCategory = origin.category || ''
		const nextCategory = next?.category || ''
		const originFolderPath = origin.folderPath || ''
		const nextFolderPath = next?.folderPath || ''
		const originFavorite = Boolean(origin.favorite)
		const nextFavorite = Boolean(next?.favorite)
		return originCategory !== nextCategory || originFolderPath !== nextFolderPath || originFavorite !== nextFavorite
	})

	return removedSlugs.length > 0 || categoryListChanged || metadataChanged
}
