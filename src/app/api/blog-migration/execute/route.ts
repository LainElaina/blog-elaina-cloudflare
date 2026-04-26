import { NextResponse } from 'next/server'

export async function POST(request: Request) {
	if (process.env.NODE_ENV !== 'development') {
		return NextResponse.json({ message: '仅开发环境可用' }, { status: 403 })
	}

	const body = (await request.json().catch(() => ({}))) as { confirmed?: boolean }
	const { executeRoute } = await import('../route-handlers.ts')
	const result = await executeRoute({
		nodeEnv: 'development',
		confirmed: body.confirmed === true,
		baseDir: process.cwd()
	})

	return NextResponse.json(result.body, { status: result.status })
}
