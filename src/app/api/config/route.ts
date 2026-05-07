import type { NextRequest } from 'next/server'
import { rejectNonLocalDevelopmentRequest } from '../local-development-request'

export async function POST(request: NextRequest) {
	const rejected = rejectNonLocalDevelopmentRequest(request)
	if (rejected) {
		return rejected
	}

	const { handleConfigPost } = await import('./route-local')
	return handleConfigPost(request)
}
