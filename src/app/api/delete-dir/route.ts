import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
	if (process.env.NODE_ENV !== 'development') {
		return NextResponse.json({ error: '此接口仅在本地开发环境可用' }, { status: 403 })
	}

	const { handleDeleteDir } = await import('./route-local')
	return handleDeleteDir(request)
}
