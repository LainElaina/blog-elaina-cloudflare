const SAFE_MARKDOWN_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:'])
const SAFE_MARKDOWN_IMAGE_PROTOCOLS = new Set(['http:', 'https:', 'blob:'])
const SAFE_EMBED_PROTOCOLS = new Set(['http:', 'https:'])

function hasUnsafeMarkdownUrlCharacter(value: string) {
	for (const char of value) {
		const code = char.charCodeAt(0)
		if (code <= 32 || code === 127) {
			return true
		}
	}
	return false
}

function isSafeMarkdownUrl(value: string | undefined, safeProtocols: Set<string>, allowRelative = true): value is string {
	const url = value?.trim()
	if (!url || url !== value || hasUnsafeMarkdownUrlCharacter(url)) {
		return false
	}
	if (url.startsWith('//')) {
		return true
	}
	const scheme = url.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/)
	if (!scheme) {
		return allowRelative
	}
	return safeProtocols.has(`${scheme[1].toLowerCase()}:`)
}

export function isSafeMarkdownLinkUrl(value: string | undefined): value is string {
	return isSafeMarkdownUrl(value, SAFE_MARKDOWN_LINK_PROTOCOLS)
}

export function isSafeMarkdownImageUrl(value: string | undefined): value is string {
	return isSafeMarkdownUrl(value, SAFE_MARKDOWN_IMAGE_PROTOCOLS)
}

export function isSafeEmbedUrl(value: string | undefined): value is string {
	return isSafeMarkdownUrl(value, SAFE_EMBED_PROTOCOLS, false)
}
