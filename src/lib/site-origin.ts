export const CANONICAL_SITE_ORIGIN = 'https://blog.lainelaina.top'

export function getSiteOrigin(): string {
	return CANONICAL_SITE_ORIGIN
}

export function toAbsoluteSiteUrl(path = ''): string {
	const normalizedOrigin = CANONICAL_SITE_ORIGIN.replace(/\/$/, '')
	const normalizedPath = path.startsWith('/') ? path : `/${path}`
	return `${normalizedOrigin}${normalizedPath}`
}
