import { NextResponse } from 'next/server'

export async function POST() {
	if (process.env.NODE_ENV !== 'development') {
		return NextResponse.json({ error: 'Only available in development' }, { status: 403 })
	}

	const { publishSiteConfigDraft, readSiteConfigDraft, resolveSiteConfigDraftPath } = await import('@/app/api/site-config-local-shared')

	try {
		const cwd = process.cwd()
		const draft = await readSiteConfigDraft(cwd)
		if (!draft) {
			return NextResponse.json({ error: '没有可发布的草稿' }, { status: 404 })
		}

		const touchedFormal = await publishSiteConfigDraft(cwd, draft)
		return NextResponse.json({ success: true, touchedFormal, clearedDraft: resolveSiteConfigDraftPath(cwd) })
	} catch (error: any) {
		return NextResponse.json({ error: error.message }, { status: 500 })
	}
}
