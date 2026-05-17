import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getLimitedJsonRequestErrorStatus, isJsonRequestBodyTooLargeError, readLimitedJsonRequest } from '../../limited-json-request.ts'
import { rejectNonLocalDevelopmentRequest, rejectUnavailableLocalDevelopmentRequest } from '../../local-development-request.ts'

const SITE_CONFIG_REQUEST_MAX_BYTES = 1024 * 1024

export async function GET(request: Request) {
	if (process.env.NODE_ENV !== 'development') {
		return rejectUnavailableLocalDevelopmentRequest()
	}

	const rejected = rejectNonLocalDevelopmentRequest(request)
	if (rejected) {
		return rejected
	}

	const { buildSiteConfigDraftItems, isSiteConfigLocalValidationError, readSiteConfigDraft } = await import('../../site-config-local-shared.ts')
	try {
		const draft = await readSiteConfigDraft(process.cwd())
		if (!draft) {
			return NextResponse.json({ hasDraft: false, items: [] })
		}

		return NextResponse.json({ hasDraft: true, items: buildSiteConfigDraftItems(draft) })
	} catch (error: any) {
		return NextResponse.json(
			{ error: isSiteConfigLocalValidationError(error) ? error.message : '读取站点配置草稿失败' },
			{ status: isSiteConfigLocalValidationError(error) ? 400 : 500 }
		)
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

	const { buildSiteConfigDraftItems, isSiteConfigLocalValidationError, isSiteConfigLocalWriteError, writeSiteConfigDraft } = await import('../../site-config-local-shared.ts')

	try {
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
		const draft = await writeSiteConfigDraft(process.cwd(), payload)
		const items = buildSiteConfigDraftItems(draft)
		return NextResponse.json({ success: true, hasDraft: items.length > 0, items })
	} catch (error: any) {
		const knownErrorMessage = isSiteConfigLocalValidationError(error) || isSiteConfigLocalWriteError(error) ? error.message : null
		return NextResponse.json(
			{ error: knownErrorMessage ?? '保存站点配置草稿失败' },
			{ status: isSiteConfigLocalValidationError(error) ? 400 : 500 }
		)
	}
}

export async function DELETE(request: Request) {
	if (process.env.NODE_ENV !== 'development') {
		return rejectUnavailableLocalDevelopmentRequest()
	}

	const rejected = rejectNonLocalDevelopmentRequest(request)
	if (rejected) {
		return rejected
	}

	const { clearSiteConfigDraft, isSiteConfigLocalValidationError } = await import('../../site-config-local-shared.ts')

	try {
		await clearSiteConfigDraft(process.cwd())
		return NextResponse.json({ success: true, hasDraft: false, items: [] })
	} catch (error) {
		if (isSiteConfigLocalValidationError(error)) {
			return NextResponse.json({ error: error.message }, { status: 400 })
		}
		const details = error instanceof Error ? error.message : String(error)
		return NextResponse.json({ error: `清除站点配置草稿失败：${details}` }, { status: 500 })
	}
}
