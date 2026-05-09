import type { BlogIndexItem } from '../blog/types.ts'

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
				title: typeof blog.title === 'string' && blog.title.trim() ? blog.title : blog.slug,
				tags: Array.isArray(blog.tags) ? blog.tags.filter((tag): tag is string => typeof tag === 'string') : [],
				date: typeof blog.date === 'string' ? blog.date : '',
				...(typeof blog.summary === 'string' ? { summary: blog.summary } : {}),
				...(typeof blog.hidden === 'boolean' ? { hidden: blog.hidden } : {})
			}
		]
	})
}
