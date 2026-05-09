import { rejectNonLocalDevelopmentRequest, rejectUnavailableLocalDevelopmentRequest } from '../local-development-request.ts'

export async function GET(request: Request) {
	if (process.env.NODE_ENV !== 'development') {
		return rejectUnavailableLocalDevelopmentRequest()
	}

	const rejected = rejectNonLocalDevelopmentRequest(request)
	if (rejected) {
		return rejected
	}

	const { handleLayoutGet } = await import('./route-local')
	return handleLayoutGet()
}

export async function POST(request: Request) {
	if (process.env.NODE_ENV !== 'development') {
		return rejectUnavailableLocalDevelopmentRequest()
	}

	const rejected = rejectNonLocalDevelopmentRequest(request)
	if (rejected) {
		return rejected
	}

	const { handleLayoutPost } = await import('./route-local')
	return handleLayoutPost(request)
}
