import type { BlogIndexItem } from '../blog/types.ts'

function isRuntimeBlogSlug(value: string): boolean {
	return value.trim().length > 0 && !value.includes('/') && !value.includes('\\')
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

export const wrapCdata = (value: string): string => `<![CDATA[${value.replaceAll(']]>', ']]]]><![CDATA[>')}]]>`
