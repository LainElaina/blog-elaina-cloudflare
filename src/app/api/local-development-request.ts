import { NextResponse } from 'next/server'

const DEVELOPMENT_ONLY_ERROR = '此接口仅在本地开发环境可用'
const LOOPBACK_ONLY_ERROR = '此接口仅允许本机开发页面调用'

function parseUrl(value: string): URL | null {
	try {
		return new URL(value)
	} catch {
		return null
	}
}

function parseHostHeader(value: string): URL | null {
	return parseUrl(`http://${value}`)
}

function isIPv4Loopback(hostname: string): boolean {
	const parts = hostname.split('.')
	if (parts.length !== 4 || parts[0] !== '127') {
		return false
	}
	return parts.every((part) => /^\d+$/.test(part) && Number(part) >= 0 && Number(part) <= 255)
}

function isLoopbackHostname(hostname: string): boolean {
	const normalized = hostname.toLowerCase()
	return normalized === 'localhost' || normalized === '::1' || normalized === '[::1]' || isIPv4Loopback(normalized)
}

function isSafeFetchSite(value: string | null): boolean {
	return !value || value === 'same-origin' || value === 'none'
}

export function isAllowedLocalDevelopmentRequest(request: Pick<Request, 'headers' | 'url'>): boolean {
	const requestUrl = parseUrl(request.url)
	if (!requestUrl || !isLoopbackHostname(requestUrl.hostname)) {
		return false
	}

	const host = request.headers.get('host')
	if (host) {
		const hostUrl = parseHostHeader(host)
		if (!hostUrl || !isLoopbackHostname(hostUrl.hostname)) {
			return false
		}
	}

	const origin = request.headers.get('origin')
	if (origin) {
		const originUrl = parseUrl(origin)
		if (!originUrl || originUrl.origin !== requestUrl.origin || !isLoopbackHostname(originUrl.hostname)) {
			return false
		}
	}

	return isSafeFetchSite(request.headers.get('sec-fetch-site'))
}

export function rejectUnavailableLocalDevelopmentRequest(): NextResponse {
	return NextResponse.json({ error: DEVELOPMENT_ONLY_ERROR }, { status: 403 })
}

export function rejectNonLocalDevelopmentRequest(request: Pick<Request, 'headers' | 'url'>): NextResponse | null {
	if (process.env.NODE_ENV !== 'development') {
		return rejectUnavailableLocalDevelopmentRequest()
	}
	if (!isAllowedLocalDevelopmentRequest(request)) {
		return NextResponse.json({ error: LOOPBACK_ONLY_ERROR }, { status: 403 })
	}
	return null
}
