export function buildPreviewResponse(params: { artifactsToRebuild: string[] }) {
	return {
		artifactsToRebuild: params.artifactsToRebuild,
		notice: '只会重建正式产物，不会修改 Markdown 或图片。'
	}
}

export function validateExecuteRequest(params: { confirmed: boolean }): { allowed: boolean; message: string | null } {
	if (!params.confirmed) {
		return {
			allowed: false,
			message: '执行前需要明确确认'
		}
	}
	return {
		allowed: true,
		message: null
	}
}
