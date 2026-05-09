import { rejectNonLocalDevelopmentRequest, rejectUnavailableLocalDevelopmentRequest } from '../../local-development-request.ts'

export async function POST(request: Request) {
	if (process.env.NODE_ENV !== 'development') {
		return rejectUnavailableLocalDevelopmentRequest()
	}

	const rejected = rejectNonLocalDevelopmentRequest(request)
	if (rejected) {
		return rejected
	}

	const { handleLayoutUndoPost } = await import('./route-local')
	return handleLayoutUndoPost()
}
