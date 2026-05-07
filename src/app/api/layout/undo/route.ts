import { rejectNonLocalDevelopmentRequest } from '../../local-development-request.ts'

export async function POST(request: Request) {
	const rejected = rejectNonLocalDevelopmentRequest(request)
	if (rejected) {
		return rejected
	}

	const { handleLayoutUndoPost } = await import('./route-local')
	return handleLayoutUndoPost()
}
