export function mergeCategoriesForSave(explicitCategories: string[], derivedCategories: string[]): string[] {
	return Array.from(new Set([...explicitCategories, ...derivedCategories]))
}

export type LocalSaveFilePayload = {
	path: string
	content: string
}

export const LOCAL_BLOG_SAVE_PATHS = {
	index: 'public/blogs/index.json',
	categories: 'public/blogs/categories.json',
	folders: 'public/blogs/folders.json',
	storage: 'public/blogs/storage.json'
} as const

export function buildLocalSaveFilePayloadsFromContents(contents: {
	index: string
	categories: string
	folders: string
	storage: string
}): LocalSaveFilePayload[] {
	return [
		{ path: LOCAL_BLOG_SAVE_PATHS.index, content: contents.index },
		{ path: LOCAL_BLOG_SAVE_PATHS.categories, content: contents.categories },
		{ path: LOCAL_BLOG_SAVE_PATHS.folders, content: contents.folders },
		{ path: LOCAL_BLOG_SAVE_PATHS.storage, content: contents.storage }
	]
}
