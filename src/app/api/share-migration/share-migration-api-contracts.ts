export type ShareMigrationOperation = 'preview' | 'execute'

export type ShareMigrationFailureCode = 'DEV_ONLY' | 'UNCONFIRMED' | 'ARTIFACT_MISSING' | 'ARTIFACT_INVALID_JSON' | 'ARTIFACT_INVALID_SHAPE' | 'WRITE_FAILED'

export type ShareMigrationPreviewSuccessResponse = {
	ok: true
	operation: 'preview'
	summary: string
	notice?: string
	artifactsToRebuild: string[]
}

export type ShareMigrationExecuteSuccessResponse = {
	ok: true
	operation: 'execute'
	summary: string
	notice?: string
	writtenArtifacts: string[]
	artifactsToRebuildBeforeExecute: string[]
	artifactsToRebuildAfterExecute: string[]
}

export type ShareMigrationFailureResponse = {
	ok: false
	operation: ShareMigrationOperation
	code: ShareMigrationFailureCode
	message: string
	details?: unknown
	writtenArtifactsPartial?: string[]
	shouldRepreview?: boolean
}

export function buildShareMigrationPreviewResponse(params: {
	summary: string
	notice?: string
	artifactsToRebuild: string[]
}): ShareMigrationPreviewSuccessResponse {
	return {
		ok: true,
		operation: 'preview',
		summary: params.summary,
		...(params.notice ? { notice: params.notice } : {}),
		artifactsToRebuild: params.artifactsToRebuild
	}
}

export function buildShareMigrationExecuteSuccessResponse(params: {
	summary: string
	notice?: string
	writtenArtifacts: string[]
	artifactsToRebuildBeforeExecute: string[]
	artifactsToRebuildAfterExecute: string[]
}): ShareMigrationExecuteSuccessResponse {
	return {
		ok: true,
		operation: 'execute',
		summary: params.summary,
		...(params.notice ? { notice: params.notice } : {}),
		writtenArtifacts: params.writtenArtifacts,
		artifactsToRebuildBeforeExecute: params.artifactsToRebuildBeforeExecute,
		artifactsToRebuildAfterExecute: params.artifactsToRebuildAfterExecute
	}
}

export function buildShareMigrationFailureResponse(params: {
	operation: ShareMigrationOperation
	code: ShareMigrationFailureCode
	message: string
	details?: unknown
	writtenArtifactsPartial?: string[]
	shouldRepreview?: boolean
}): ShareMigrationFailureResponse {
	return {
		ok: false,
		operation: params.operation,
		code: params.code,
		message: params.message,
		...(params.details !== undefined ? { details: params.details } : {}),
		...(params.writtenArtifactsPartial !== undefined ? { writtenArtifactsPartial: params.writtenArtifactsPartial } : {}),
		...(params.shouldRepreview !== undefined ? { shouldRepreview: params.shouldRepreview } : {})
	}
}

export function validateShareMigrationExecuteRequest(params: { confirmed: unknown }): { allowed: true } | { allowed: false; message: string } {
	if (params.confirmed !== true) {
		return {
			allowed: false,
			message: '执行前需要明确确认'
		}
	}

	return {
		allowed: true
	}
}
