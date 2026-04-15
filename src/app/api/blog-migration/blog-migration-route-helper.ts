import {
  buildExecuteSuccessResponse,
  buildPreviewResponse,
  validateExecuteRequest
} from './blog-migration-contracts.ts'

export function enforceDevelopmentOnly(nodeEnv: string) {
  if (nodeEnv !== 'development') {
    return {
      allowed: false,
      status: 403,
      message: '仅开发环境可用'
    }
  }

  return {
    allowed: true,
    status: 200,
    message: null
  }
}

export function buildPreviewRouteResponse(params: { artifactsToRebuild: string[] }) {
  return {
    status: 200,
    body: buildPreviewResponse(params)
  }
}

export function buildExecuteResponse(
  params:
    | { confirmed: false }
    | {
        confirmed: true
        writtenArtifacts: string[]
        artifactsToRebuildBeforeExecute: string[]
        artifactsToRebuildAfterExecute: string[]
      }
) {
  const validation = validateExecuteRequest({ confirmed: params.confirmed })
  if (!validation.allowed) {
    return {
      status: 400,
      body: { message: validation.message }
    }
  }

  return {
    status: 200,
    body: buildExecuteSuccessResponse({
      writtenArtifacts: params.writtenArtifacts,
      artifactsToRebuildBeforeExecute: params.artifactsToRebuildBeforeExecute,
      artifactsToRebuildAfterExecute: params.artifactsToRebuildAfterExecute
    })
  }
}
