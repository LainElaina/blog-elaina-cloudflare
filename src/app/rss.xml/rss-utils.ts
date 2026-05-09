import type { BlogIndexItem } from '../blog/types.ts'

export const MAX_FEED_ITEMS = 100
export const MAX_RSS_TEXT_LENGTH = 2000

function isSafeUriComponent(value: string): boolean {
	try {
		encodeURIComponent(value)
		return true
	} catch {
		return false
	}
}

export function isRuntimeBlogSlug(value: string): boolean {
	return value.trim() === value && value.length > 0 && !value.includes('/') && !value.includes('\\') && isSafeUriComponent(value)
}

export function sanitizeXmlText(value: string): string {
	let sanitized = ''
	for (const char of value) {
		const code = char.codePointAt(0) ?? 0
		if (code === 9 || code === 10 || code === 13 || code >= 32 && code <= 0xd7ff || code >= 0xe000 && code <= 0xfffd || code >= 0x10000 && code <= 0x10ffff) {
			sanitized += char
		}
	}
	return sanitized
}

export function escapeXml(value: string): string {
	return sanitizeXmlText(value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;')
}

export function wrapCdata(value: string): string {
	return `<![CDATA[${sanitizeXmlText(value).replaceAll(']]>', ']]]]><![CDATA[>')}]]>`
}

export function limitRssText(value: string): string {
	if (value.length <= MAX_RSS_TEXT_LENGTH) return value
	return `${value.slice(0, MAX_RSS_TEXT_LENGTH)}…`
}

export function normalizeBlogIndexForRss(input: unknown): BlogIndexItem[] {
	if (!Array.isArray(input)) {
		return []
	}

	return input.flatMap(item => {
		if (!item || typeof item !== 'object' || Array.isArray(item)) {
			return []
		}

		const blog = item as Record<string, unknown>
		if (typeof blog.slug !== 'string' || !isRuntimeBlogSlug(blog.slug)) {
			return []
		}

		return [
			{
				slug: blog.slug,
				title: limitRssText(typeof blog.title === 'string' && blog.title.trim() ? blog.title : blog.slug),
				tags: Array.isArray(blog.tags) ? blog.tags.filter((tag): tag is string => typeof tag === 'string').map(limitRssText) : [],
				date: typeof blog.date === 'string' ? blog.date : '',
				...(typeof blog.summary === 'string' ? { summary: limitRssText(blog.summary) } : {}),
				...(typeof blog.hidden === 'boolean' ? { hidden: blog.hidden } : {})
			}
		]
	})
}

export function normalizeVisibleRssItems(input: unknown): BlogIndexItem[] {
	return normalizeBlogIndexForRss(input)
		.filter(item => !item.hidden)
		.slice(0, MAX_FEED_ITEMS)
}
