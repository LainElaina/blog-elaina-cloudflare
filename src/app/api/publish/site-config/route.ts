import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getLimitedJsonRequestErrorStatus, isJsonRequestBodyTooLargeError, readLimitedJsonRequest } from '../../limited-json-request.ts'
import { rejectNonLocalDevelopmentRequest, rejectUnavailableLocalDevelopmentRequest } from '../../local-development-request.ts'

const SITE_CONFIG_REQUEST_MAX_BYTES = 1024 * 1024

export async function POST(request: NextRequest) {
	if (process.env.NODE_ENV !== 'development') {
		return rejectUnavailableLocalDevelopmentRequest()
	}

	const rejected = rejectNonLocalDevelopmentRequest(request)
	if (rejected) {
		return rejected
	}

	const { isSiteConfigLocalValidationError, publishResolvedSiteConfigDraft } = await import('../../site-config-local-shared.ts')

	try {
		const cwd = process.cwd()
		let payload: unknown
		try {
			payload = await readLimitedJsonRequest(request, SITE_CONFIG_REQUEST_MAX_BYTES)
		} catch (error) {
			return NextResponse.json(
				{ error: isJsonRequestBodyTooLargeError(error) ? '请求 JSON 过大' : '请求 JSON 格式错误' },
				{ status: getLimitedJsonRequestErrorStatus(error) }
			)
		}
		if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
			return NextResponse.json({ error: '请求 JSON 格式错误' }, { status: 400 })
		}
		const touchedFormal = await publishResolvedSiteConfigDraft(cwd, payload as Record<string, unknown>)
		return NextResponse.json({ success: true, touchedFormal, clearedDraft: 'data/site-config.draft.json' })
	} catch (error: any) {
		return NextResponse.json(
			{ error: isSiteConfigLocalValidationError(error) ? error.message : '发布站点配置草稿失败' },
			{ status: isSiteConfigLocalValidationError(error) ? 400 : 500 }
		)
	}
}
