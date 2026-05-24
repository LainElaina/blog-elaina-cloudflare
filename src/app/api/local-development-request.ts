import { NextResponse } from 'next/server'

const DEVELOPMENT_ONLY_ERROR = '此接口仅在本地开发环境可用'
export function isAllowedLocalDevelopmentRequest(_request: Pick<Request, 'headers' | 'url'>): boolean {
	return process.env.NODE_ENV === 'development'
}

export function rejectUnavailableLocalDevelopmentRequest(): NextResponse {
	return NextResponse.json({ error: DEVELOPMENT_ONLY_ERROR }, { status: 403 })
}

export function rejectNonLocalDevelopmentRequest(_request: Pick<Request, 'headers' | 'url'>): NextResponse | null {
	if (process.env.NODE_ENV !== 'development') {
		return rejectUnavailableLocalDevelopmentRequest()
	}
	return null
}
