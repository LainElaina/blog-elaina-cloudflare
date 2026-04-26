import { NextResponse } from 'next/server'

export async function GET() {
	if (process.env.NODE_ENV !== 'development') {
		return NextResponse.json({ error: 'Only available in development' }, { status: 403 })
	}

	const { handleLayoutGet } = await import('./route-local')
	return handleLayoutGet()
}

export async function POST(request: Request) {
	if (process.env.NODE_ENV !== 'development') {
		return NextResponse.json({ error: 'Only available in development' }, { status: 403 })
	}

	const { handleLayoutPost } = await import('./route-local')
	return handleLayoutPost(request)
}
