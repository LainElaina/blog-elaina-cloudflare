import type { NextRequest } from 'next/server'
import { rejectNonLocalDevelopmentRequest, rejectUnavailableLocalDevelopmentRequest } from '../local-development-request.ts'

export async function POST(request: NextRequest) {
	if (process.env.NODE_ENV !== 'development') {
		return rejectUnavailableLocalDevelopmentRequest()
	}

	const rejected = rejectNonLocalDevelopmentRequest(request)
	if (rejected) {
		return rejected
	}

	const { handleDeleteDir } = await import('./route-local')
	return handleDeleteDir(request)
}
