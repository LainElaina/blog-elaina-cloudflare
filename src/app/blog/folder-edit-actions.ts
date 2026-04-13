export function getAssignFolderActionState(params: {
	selectedCount: number
	availableFolderPaths: string[]
}): { allowed: boolean; message: string | null } {
	if (params.selectedCount === 0) {
		return { allowed: false, message: '请选择要分配目录的文章' }
	}
	if (params.availableFolderPaths.length === 0) {
		return { allowed: false, message: '请先新建目录' }
	}
	return { allowed: true, message: null }
}

export function getClearFolderActionState(selectedCount: number): {
	buttonLabel: string
	confirmRequired: boolean
	selectedCount: number
} {
	return {
		buttonLabel: '清空目录',
		confirmRequired: true,
		selectedCount
	}
}
