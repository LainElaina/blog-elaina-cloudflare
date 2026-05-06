import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export async function GET() {
	if (process.env.NODE_ENV !== 'development') {
		return NextResponse.json({ error: 'Only available in development' }, { status: 403 })
	}

	const { buildSiteConfigDraftItems, readSiteConfigDraft } = await import('@/app/api/site-config-local-shared')
	const draft = await readSiteConfigDraft(process.cwd())
	if (!draft) {
		return NextResponse.json({ hasDraft: false, items: [] })
	}

	return NextResponse.json({ hasDraft: true, items: buildSiteConfigDraftItems(draft) })
}

export async function POST(request: NextRequest) {
	if (process.env.NODE_ENV !== 'development') {
		return NextResponse.json({ error: 'Only available in development' }, { status: 403 })
	}

	const { buildSiteConfigDraftItems, isSiteConfigLocalValidationError, writeSiteConfigDraft } = await import('@/app/api/site-config-local-shared')

	try {
		let payload: unknown
		try {
			payload = await request.json()
		} catch {
			return NextResponse.json({ error: '请求 JSON 格式错误' }, { status: 400 })
		}
		if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
			return NextResponse.json({ error: '请求 JSON 格式错误' }, { status: 400 })
		}
		const draft = await writeSiteConfigDraft(process.cwd(), payload)
		const items = buildSiteConfigDraftItems(draft)
		return NextResponse.json({ success: true, hasDraft: items.length > 0, items })
	} catch (error: any) {
		return NextResponse.json({ error: error.message }, { status: isSiteConfigLocalValidationError(error) ? 400 : 500 })
	}
}

export async function DELETE() {
	if (process.env.NODE_ENV !== 'development') {
		return NextResponse.json({ error: 'Only available in development' }, { status: 403 })
	}

	const { clearSiteConfigDraft } = await import('@/app/api/site-config-local-shared')

	try {
		await clearSiteConfigDraft(process.cwd())
		return NextResponse.json({ success: true, hasDraft: false, items: [] })
	} catch (error: any) {
		return NextResponse.json({ error: error.message }, { status: 500 })
	}
}
