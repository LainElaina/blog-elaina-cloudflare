export function getBlogHref(slug: string) {
	return `/blog/${encodeURIComponent(slug)}`
}

export function getWriteHref(slug: string) {
	return `/write/${encodeURIComponent(slug)}`
}
