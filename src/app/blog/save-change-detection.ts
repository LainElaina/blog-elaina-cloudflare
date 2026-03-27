import type { BlogIndexItem } from './types'

export function normalizeCategoryList(list: string[]): string[] {
	return list.map(c => c.trim()).filter(Boolean)
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
