const SAFE_BLOG_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const MAX_BLOG_SLUG_LENGTH = 120

export function assertSafeBlogSlug(slug: string): void {
	const normalizedSlug = slug.trim()
	if (normalizedSlug !== slug || !normalizedSlug || normalizedSlug.length > MAX_BLOG_SLUG_LENGTH || !SAFE_BLOG_SLUG_PATTERN.test(normalizedSlug)) {
		throw new Error('slug 只能使用小写字母、数字和单个连字符，且不能包含路径分隔符')
	}
}
