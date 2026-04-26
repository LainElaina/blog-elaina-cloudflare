import { NextResponse } from 'next/server'

export async function POST() {
	if (process.env.NODE_ENV !== 'development') {
		return NextResponse.json({ error: 'Only available in development' }, { status: 403 })
	}

	const { handleLayoutUndoPost } = await import('./route-local')
	return handleLayoutUndoPost()
}
