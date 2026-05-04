import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
	if (process.env.NODE_ENV !== 'development') {
		return NextResponse.json({ error: 'Only available in development' }, { status: 403 })
	}

	const { publishSiteConfigDraft, resolveSiteConfigDraftPath, resolveSiteConfigPublishPayload } = await import('@/app/api/site-config-local-shared')

	try {
		const cwd = process.cwd()
		let payload: unknown
		try {
			payload = await request.json()
		} catch {
			return NextResponse.json({ error: '请求 JSON 格式错误' }, { status: 400 })
		}
		if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
			return NextResponse.json({ error: '请求 JSON 格式错误' }, { status: 400 })
		}
		const publishPayload = await resolveSiteConfigPublishPayload(cwd, payload as Record<string, unknown>)
		const touchedFormal = await publishSiteConfigDraft(cwd, publishPayload)
		return NextResponse.json({ success: true, touchedFormal, clearedDraft: resolveSiteConfigDraftPath(cwd) })
	} catch (error: any) {
		return NextResponse.json({ error: error.message }, { status: 500 })
	}
}
