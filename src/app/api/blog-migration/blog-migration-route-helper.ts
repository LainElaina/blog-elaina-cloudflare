import { buildPreviewResponse, validateExecuteRequest } from './blog-migration-contracts.ts'

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

export function buildExecuteResponse(params: { confirmed: boolean }) {
  const validation = validateExecuteRequest(params)
  return {
    status: validation.allowed ? 200 : 400,
    body: validation.allowed ? { ok: true } : { message: validation.message }
  }
}
