import {
	buildShareMigrationExecuteSuccessResponse,
	buildShareMigrationFailureResponse,
	buildShareMigrationPreviewResponse,
	type ShareMigrationExecuteSuccessResponse,
	type ShareMigrationFailureResponse,
	type ShareMigrationOperation,
	type ShareMigrationPreviewSuccessResponse,
	validateShareMigrationExecuteRequest
} from './share-migration-api-contracts.ts'

type ShareMigrationRouteResponse<TBody> = {
	status: number
	body: TBody
}

export function enforceDevelopmentOnly(params: { nodeEnv: string | undefined; operation: ShareMigrationOperation }):
	| { allowed: true }
	| (ShareMigrationRouteResponse<ShareMigrationFailureResponse> & {
			allowed: false
	  }) {
	if (params.nodeEnv !== 'development') {
		return {
			allowed: false,
			status: 403,
			body: buildShareMigrationFailureResponse({
				operation: params.operation,
				code: 'DEV_ONLY',
				message: '仅开发环境可用'
			})
		}
	}

	return {
		allowed: true
	}
}

export function buildShareMigrationPreviewRouteResponse(params: {
	summary: string
	notice?: string
	artifactsToRebuild: string[]
}): ShareMigrationRouteResponse<ShareMigrationPreviewSuccessResponse> {
	return {
		status: 200,
		body: buildShareMigrationPreviewResponse(params)
	}
}

export function buildShareMigrationExecuteRouteResponse(params: {
	confirmed: unknown
	summary: string
	notice?: string
	writtenArtifacts: string[]
	artifactsToRebuildBeforeExecute: string[]
	artifactsToRebuildAfterExecute: string[]
}): ShareMigrationRouteResponse<ShareMigrationExecuteSuccessResponse> | ShareMigrationRouteResponse<ShareMigrationFailureResponse> {
	const validation = validateShareMigrationExecuteRequest({ confirmed: params.confirmed })
	if (!validation.allowed) {
		return {
			status: 400,
			body: buildShareMigrationFailureResponse({
				operation: 'execute',
				code: 'UNCONFIRMED',
				message: validation.message
			})
		}
	}

	return {
		status: 200,
		body: buildShareMigrationExecuteSuccessResponse({
			summary: params.summary,
			notice: params.notice,
			writtenArtifacts: params.writtenArtifacts,
			artifactsToRebuildBeforeExecute: params.artifactsToRebuildBeforeExecute,
			artifactsToRebuildAfterExecute: params.artifactsToRebuildAfterExecute
		})
	}
}
