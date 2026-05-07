import { NextResponse } from 'next/server'
import { rejectNonLocalDevelopmentRequest } from '../../local-development-request.ts'

export async function GET(request: Request) {
	const rejected = rejectNonLocalDevelopmentRequest(request)
	if (rejected) {
		return rejected
	}

	const { previewRoute } = await import('../route-handlers.ts')
	const result = await previewRoute({
		nodeEnv: 'development',
		baseDir: process.cwd()
	})

	return NextResponse.json(result.body, { status: result.status })
}
