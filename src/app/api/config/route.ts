import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
	if (process.env.NODE_ENV !== 'development') {
		return NextResponse.json({ error: 'Only available in development' }, { status: 403 })
	}

	const { handleConfigPost } = await import('./route-local')
	return handleConfigPost(request)
}
