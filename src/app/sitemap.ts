import { MetadataRoute } from 'next'
import blogIndex from '@/../public/blogs/index.json'
import { getSiteOrigin, toAbsoluteSiteUrl } from '@/lib/site-origin'

type SitemapBlogPost = {
	slug: string
	date?: string
}

export const dynamic = 'force-static'

export function normalizeSitemapBlogPosts(value: unknown): SitemapBlogPost[] {
	if (!Array.isArray(value)) {
		return []
	}

	return value.flatMap(item => {
		if (!item || typeof item !== 'object' || Array.isArray(item)) {
			return []
		}

		const post = item as Record<string, unknown>
		if (typeof post.slug !== 'string' || post.slug.length === 0 || post.hidden) {
			return []
		}

		return [
			{
				slug: post.slug,
				...(typeof post.date === 'string' ? { date: post.date } : {})
			}
		]
	})
}

export function buildSitemapEntries(value: unknown, baseUrl = getSiteOrigin()): MetadataRoute.Sitemap {
	const posts = normalizeSitemapBlogPosts(value)

	const postEntries: MetadataRoute.Sitemap = posts.map(post => {
		const lastModified = post.date ? new Date(post.date) : null
		const resolvedLastModified = lastModified && !Number.isNaN(lastModified.getTime()) ? lastModified : undefined

		return {
			url: toAbsoluteSiteUrl(`/blog/${post.slug}`),
			...(resolvedLastModified ? { lastModified: resolvedLastModified } : {}),
			changeFrequency: 'weekly',
			priority: 0.8
		}
	})

	const staticEntries: MetadataRoute.Sitemap = [
		{
			url: baseUrl,
			lastModified: new Date(),
			changeFrequency: 'daily',
			priority: 1
		}
	]

	return [...staticEntries, ...postEntries]
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const baseUrl = getSiteOrigin()

	console.log(`[Sitemap] Generating for: ${baseUrl}`)

	return buildSitemapEntries(blogIndex, baseUrl)
}
