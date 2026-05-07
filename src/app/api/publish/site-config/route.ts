import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { isJsonRequestBodyTooLargeError, readLimitedJsonRequest } from '../../limited-json-request.ts'
import { rejectNonLocalDevelopmentRequest } from '../../local-development-request.ts'

const SITE_CONFIG_REQUEST_MAX_BYTES = 1024 * 1024

function getContentLength(request: Request) {
	const value = request.headers?.get('content-length')
	if (!value) return null
	const length = Number(value)
	return Number.isFinite(length) && length >= 0 ? length : null
}

export async function POST(request: NextRequest) {
	const rejected = rejectNonLocalDevelopmentRequest(request)
	if (rejected) {
		return rejected
	}

	const { isSiteConfigLocalValidationError, publishResolvedSiteConfigDraft } = await import('../../site-config-local-shared.ts')

	try {
		const cwd = process.cwd()
		const contentLength = getContentLength(request)
		if (contentLength !== null && contentLength > SITE_CONFIG_REQUEST_MAX_BYTES) {
			return NextResponse.json({ error: '请求 JSON 过大' }, { status: 400 })
		}

		let payload: unknown
		try {
			payload = await readLimitedJsonRequest(request, SITE_CONFIG_REQUEST_MAX_BYTES)
		} catch (error) {
			return NextResponse.json({ error: isJsonRequestBodyTooLargeError(error) ? '请求 JSON 过大' : '请求 JSON 格式错误' }, { status: 400 })
		}
		if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
			return NextResponse.json({ error: '请求 JSON 格式错误' }, { status: 400 })
		}
		const touchedFormal = await publishResolvedSiteConfigDraft(cwd, payload as Record<string, unknown>)
		return NextResponse.json({ success: true, touchedFormal, clearedDraft: 'data/site-config.draft.json' })
	} catch (error: any) {
		return NextResponse.json({ error: error.message }, { status: isSiteConfigLocalValidationError(error) ? 400 : 500 })
	}
}
