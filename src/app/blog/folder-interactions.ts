export type FolderOption = {
	value: string
	label: string
}

export function normalizeCreatedFolderPath(input: string): string {
	const parts = input
		.split('/')
		.map(part => part.trim())
		.filter(Boolean)
	return `/${parts.join('/')}`
}

export function createFolderOptionList(existingFolders: string[], createdFolderPath?: string): string[] {
	const values = new Set(existingFolders.filter(Boolean))
	if (createdFolderPath) {
		values.add(createdFolderPath)
	}
	return Array.from(values).sort((a, b) => a.localeCompare(b))
}

export function buildFolderSelectionState(folders: string[], _currentValue: string): {
	hasFolders: boolean
	emptyMessage: string | null
	options: FolderOption[]
} {
	const options = [{ value: '', label: '默认目录' }, ...folders.map(folder => ({ value: folder, label: folder }))]
	return {
		hasFolders: folders.length > 0,
		emptyMessage: folders.length === 0 ? '暂无目录，请先新建目录' : null,
		options
	}
}

export function buildClearFolderDialogCopy(selectedCount: number): {
	title: string
	description: string
	confirmText: string
} {
	return {
		title: '清空目录归属',
		description: `这会清除所选 ${selectedCount} 篇文章的目录归属，不会删除文章内容，也不会删除目录本身。`,
		confirmText: '确认清空目录'
	}
}
