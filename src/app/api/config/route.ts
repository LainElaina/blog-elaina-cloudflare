import type { NextRequest } from 'next/server'
import { rejectNonLocalDevelopmentRequest, rejectUnavailableLocalDevelopmentRequest } from '../local-development-request'

export async function POST(request: NextRequest) {
	if (process.env.NODE_ENV !== 'development') {
		return rejectUnavailableLocalDevelopmentRequest()
	}

	const rejected = rejectNonLocalDevelopmentRequest(request)
	if (rejected) {
		return rejected
	}

	const { handleConfigPost } = await import('./route-local')
	return handleConfigPost(request)
}
