export function getBlogHref(slug: string) {
	return `/blog/${encodeURIComponent(slug)}`
}
