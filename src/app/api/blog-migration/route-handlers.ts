import { buildExecuteResponse, buildPreviewRouteResponse, enforceDevelopmentOnly } from './blog-migration-route-helper.ts'

export async function previewRoute(params: { nodeEnv: string; artifactsToRebuild: string[] }) {
  const access = enforceDevelopmentOnly(params.nodeEnv)
  if (!access.allowed) {
    return {
      status: access.status,
      body: { message: access.message }
    }
  }

  return buildPreviewRouteResponse({
    artifactsToRebuild: params.artifactsToRebuild
  })
}

export async function executeRoute(params: { nodeEnv: string; confirmed: boolean }) {
  const access = enforceDevelopmentOnly(params.nodeEnv)
  if (!access.allowed) {
    return {
      status: access.status,
      body: { message: access.message }
    }
  }

  return buildExecuteResponse({ confirmed: params.confirmed })
}
