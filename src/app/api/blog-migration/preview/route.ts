import { NextResponse } from 'next/server'

export async function GET() {
	if (process.env.NODE_ENV !== 'development') {
		return NextResponse.json({ message: '仅开发环境可用' }, { status: 403 })
	}

	const { previewRoute } = await import('../route-handlers.ts')
	const result = await previewRoute({
		nodeEnv: 'development',
		baseDir: process.cwd()
	})

	return NextResponse.json(result.body, { status: result.status })
}
