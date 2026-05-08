export function normalizeShareUrlInput(input: string): string {
	return input.trim()
}

export function isAllowedShareUrl(value: string): boolean {
	if (!value) {
		return true
	}
	try {
		const url = new URL(value)
		return url.protocol === 'http:' || url.protocol === 'https:'
	} catch {
		return false
	}
}

export function assertAllowedShareUrlInput(input: string): string {
	const value = normalizeShareUrlInput(input)
	if (!isAllowedShareUrl(value)) {
		throw new Error('URL 仅支持 http 或 https')
	}
	return value
}
