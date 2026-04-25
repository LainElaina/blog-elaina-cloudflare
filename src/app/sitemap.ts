import { MetadataRoute } from 'next'
import blogIndex from '@/../public/blogs/index.json'
import type { BlogIndexItem } from '@/app/blog/types'
import { getSiteOrigin, toAbsoluteSiteUrl } from '@/lib/site-origin'

export const dynamic = 'force-static'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const baseUrl = getSiteOrigin()

	console.log(`[Sitemap] Generating for: ${baseUrl}`)

	const posts: BlogIndexItem[] = (blogIndex as BlogIndexItem[]).filter(post => post?.slug)

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
			url: getSiteOrigin(),
			lastModified: new Date(),
			changeFrequency: 'daily',
			priority: 1
		}
	]

	return [...staticEntries, ...postEntries]
}
