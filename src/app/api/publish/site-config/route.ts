import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { isJsonRequestBodyTooLargeError, readLimitedJsonRequest } from '@/app/api/limited-json-request'

const SITE_CONFIG_REQUEST_MAX_BYTES = 1024 * 1024

export async function POST(request: NextRequest) {
	if (process.env.NODE_ENV !== 'development') {
		return NextResponse.json({ error: 'Only available in development' }, { status: 403 })
	}

	const { isSiteConfigLocalValidationError, publishSiteConfigDraft, resolveSiteConfigDraftPath, resolveSiteConfigPublishPayload } = await import('@/app/api/site-config-local-shared')

	try {
		const cwd = process.cwd()
		let payload: unknown
		try {
			payload = await readLimitedJsonRequest(request, SITE_CONFIG_REQUEST_MAX_BYTES)
		} catch (error) {
			return NextResponse.json({ error: isJsonRequestBodyTooLargeError(error) ? '请求 JSON 过大' : '请求 JSON 格式错误' }, { status: 400 })
		}
		if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
			return NextResponse.json({ error: '请求 JSON 格式错误' }, { status: 400 })
		}
		const publishPayload = await resolveSiteConfigPublishPayload(cwd, payload as Record<string, unknown>)
		const touchedFormal = await publishSiteConfigDraft(cwd, publishPayload)
		return NextResponse.json({ success: true, touchedFormal, clearedDraft: resolveSiteConfigDraftPath(cwd) })
	} catch (error: any) {
		return NextResponse.json({ error: error.message }, { status: isSiteConfigLocalValidationError(error) ? 400 : 500 })
	}
}
