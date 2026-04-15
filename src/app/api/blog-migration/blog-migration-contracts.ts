function formatArtifacts(artifacts: string[]) {
	return artifacts.length > 0 ? artifacts.join('、') : '无'
}

export function buildPreviewResponse(params: { artifactsToRebuild: string[] }) {
	return {
		artifactsToRebuild: params.artifactsToRebuild,
		notice: '只会重建正式产物，不会修改 Markdown 或图片。',
		summary:
			params.artifactsToRebuild.length > 0
				? `待重建产物：${formatArtifacts(params.artifactsToRebuild)}`
				: '当前正式产物已与账本一致，无需重建。'
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

export function buildExecuteSuccessResponse(params: {
	writtenArtifacts: string[]
	artifactsToRebuildBeforeExecute: string[]
	artifactsToRebuildAfterExecute: string[]
}) {
	const afterSummary =
		params.artifactsToRebuildAfterExecute.length === 0
			? '执行后无需再重建。'
			: `执行后仍需重建：${formatArtifacts(params.artifactsToRebuildAfterExecute)}。`

	return {
		ok: true,
		writtenArtifacts: params.writtenArtifacts,
		artifactsToRebuildBeforeExecute: params.artifactsToRebuildBeforeExecute,
		artifactsToRebuildAfterExecute: params.artifactsToRebuildAfterExecute,
		notice: '只会重建正式产物，不会修改 Markdown 或图片。',
		summary: `已同步账本并重建 ${params.writtenArtifacts.length} 个产物：${formatArtifacts(params.writtenArtifacts)}。${afterSummary}`
	}
}
