import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getLimitedJsonRequestErrorStatus, isJsonRequestBodyTooLargeError, readLimitedJsonRequest } from '../../limited-json-request.ts'
import { rejectNonLocalDevelopmentRequest, rejectUnavailableLocalDevelopmentRequest } from '../../local-development-request.ts'

const SITE_CONFIG_REQUEST_MAX_BYTES = 1024 * 1024

function getSiteConfigPublishErrorDetails(error: unknown) {
	const touchedFormalPartial = error && typeof error === 'object' && 'touchedFormalPartial' in error && Array.isArray(error.touchedFormalPartial)
		? error.touchedFormalPartial.filter(fileName => typeof fileName === 'string')
		: []
	const rollbackFailedFormal = error && typeof error === 'object' && 'rollbackFailedFormal' in error && Array.isArray(error.rollbackFailedFormal)
		? error.rollbackFailedFormal.filter(fileName => typeof fileName === 'string')
		: []

	return {
		touchedFormalPartial,
		rollbackFailedFormal
	}
}

function buildSiteConfigPublishFailureBody(error: unknown, validationMessage: string | null) {
	if (validationMessage) {
		return { error: validationMessage }
	}

	const { touchedFormalPartial, rollbackFailedFormal } = getSiteConfigPublishErrorDetails(error)
	return {
		error: '发布站点配置草稿失败',
		...(touchedFormalPartial.length > 0 ? { touchedFormalPartial } : {}),
		...(rollbackFailedFormal.length > 0
			? {
				details: {
					rollbackFailedFormal
				}
			}
			: {})
	}
}

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
		const validationMessage = isSiteConfigLocalValidationError(error) ? error.message : null
		return NextResponse.json(
			buildSiteConfigPublishFailureBody(error, validationMessage),
			{ status: validationMessage ? 400 : 500 }
		)
	}
}
