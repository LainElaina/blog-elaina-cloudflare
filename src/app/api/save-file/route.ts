import type { NextRequest } from 'next/server'
import { rejectNonLocalDevelopmentRequest } from '../local-development-request.ts'

export async function POST(request: NextRequest) {
	const rejected = rejectNonLocalDevelopmentRequest(request)
	if (rejected) {
		return rejected
	}

	const { handleSaveFile } = await import('./route-local')
	return handleSaveFile(request)
}
