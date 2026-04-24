import { createFolderOptionList, normalizeCreatedFolderPath } from '../../../blog/folder-interactions'

export type FolderSelectViewModel = {
	options: Array<{ value: string; label: string }>
	emptyMessage: string | null
	createButtonLabel: string
	nextValueAfterCreate?: string
}

export function buildFolderSelectViewModel(params: { folders: string[]; value: string; createdFolderInput?: string }): FolderSelectViewModel {
	const createdFolderPath = params.createdFolderInput ? normalizeCreatedFolderPath(params.createdFolderInput) : undefined
	const representableValue = createdFolderPath ?? (params.value || undefined)
	const folders = createFolderOptionList(params.folders, representableValue)

	return {
		options: [{ value: '', label: '默认目录' }, ...folders.map(folder => ({ value: folder, label: folder }))],
		emptyMessage: folders.length === 0 ? '暂无目录，请先新建目录' : null,
		createButtonLabel: '新建目录',
		nextValueAfterCreate: createdFolderPath
	}
}
