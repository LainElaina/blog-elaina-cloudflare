export const CANONICAL_SITE_ORIGIN = 'https://blog.lainelaina.top'

export function getSiteOrigin(): string {
	return CANONICAL_SITE_ORIGIN
}

export function toAbsoluteSiteUrl(path = '', origin = CANONICAL_SITE_ORIGIN): string {
	const normalizedOrigin = origin.replace(/\/$/, '')
	if (!path) return normalizedOrigin
	const normalizedPath = path.startsWith('/') ? path : `/${path}`
	return `${normalizedOrigin}${normalizedPath}`
}
