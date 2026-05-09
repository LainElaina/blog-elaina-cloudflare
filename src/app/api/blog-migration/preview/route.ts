import { NextResponse } from 'next/server'
import { rejectNonLocalDevelopmentRequest, rejectUnavailableLocalDevelopmentRequest } from '../../local-development-request.ts'

export async function GET(request: Request) {
	if (process.env.NODE_ENV !== 'development') {
		return rejectUnavailableLocalDevelopmentRequest()
	}

	const rejected = rejectNonLocalDevelopmentRequest(request)
	if (rejected) {
		return rejected
	}

	const { previewRoute } = await import('../route-handlers.ts')
	const result = await previewRoute({
		nodeEnv: process.env.NODE_ENV,
		baseDir: process.cwd()
	})

	return NextResponse.json(result.body, { status: result.status })
}
