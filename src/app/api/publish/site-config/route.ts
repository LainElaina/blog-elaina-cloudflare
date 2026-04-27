import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
	if (process.env.NODE_ENV !== 'development') {
		return NextResponse.json({ error: 'Only available in development' }, { status: 403 })
	}

	const { publishSiteConfigDraft, resolveSiteConfigDraftPath, resolveSiteConfigPublishPayload } = await import('@/app/api/site-config-local-shared')

	try {
		const cwd = process.cwd()
		const payload = await request.json().catch(() => ({}))
		const publishPayload = await resolveSiteConfigPublishPayload(cwd, payload)
		const touchedFormal = await publishSiteConfigDraft(cwd, publishPayload)
		return NextResponse.json({ success: true, touchedFormal, clearedDraft: resolveSiteConfigDraftPath(cwd) })
	} catch (error: any) {
		return NextResponse.json({ error: error.message }, { status: 500 })
	}
}
