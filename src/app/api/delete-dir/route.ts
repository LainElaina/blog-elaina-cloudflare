import type { NextRequest } from 'next/server'
import { rejectNonLocalDevelopmentRequest } from '../local-development-request.ts'

export async function POST(request: NextRequest) {
	const rejected = rejectNonLocalDevelopmentRequest(request)
	if (rejected) {
		return rejected
	}

	const { handleDeleteDir } = await import('./route-local')
	return handleDeleteDir(request)
}
