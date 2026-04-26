import siteContent from '@/config/site-content.json'
import blogIndex from '@/../public/blogs/index.json'
import type { BlogIndexItem } from '@/app/blog/types'
import { getSiteOrigin, toAbsoluteSiteUrl } from '@/lib/site-origin'

const SITE_ORIGIN = getSiteOrigin()
const FEED_PATH = '/rss.xml'
const FEED_URL = toAbsoluteSiteUrl(FEED_PATH)

const blogs = blogIndex as BlogIndexItem[]

const escapeXml = (value: string): string =>
	value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

const wrapCdata = (value: string): string => `<![CDATA[${value}]]>`

const serializeItem = (item: BlogIndexItem): string => {
	const link = toAbsoluteSiteUrl(`/blog/${item.slug}`)
	const title = escapeXml(item.title || item.slug)
	const description = wrapCdata(item.summary || '')
	const parsedPubDate = item.date ? new Date(item.date) : null
	const pubDate = parsedPubDate && !Number.isNaN(parsedPubDate.getTime()) ? `<pubDate>${parsedPubDate.toUTCString()}</pubDate>` : ''
	const categories = (item.tags || [])
		.filter(Boolean)
		.map(tag => `<category>${escapeXml(tag)}</category>`)
		.join('')

	return `
		<item>
			<title>${title}</title>
			<link>${link}</link>
			<guid isPermaLink="false">${escapeXml(link)}</guid>
			<description>${description}</description>
			${pubDate}
			${categories}
		</item>`.trim()
}

export const dynamic = 'force-static'
export const revalidate = false

export function GET(): Response {
	const title = siteContent.meta?.title || '2025 Blog'
	const description = siteContent.meta?.description || 'Latest updates from 2025 Blog'

	const items = blogs
		.filter(item => item?.slug)
		.map(serializeItem)
		.join('')

	const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
	<channel xmlns:atom="http://www.w3.org/2005/Atom">
		<title>${escapeXml(title)}</title>
		<link>${SITE_ORIGIN}</link>
		<atom:link href="${FEED_URL}" rel="self" type="application/rss+xml" />
		<description>${escapeXml(description)}</description>
		<language>zh-CN</language>
		<docs>https://www.rssboard.org/rss-specification</docs>
		<ttl>60</ttl>
		<lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
		${items}
	</channel>
</rss>`

	return new Response(rss, {
		headers: {
			'Content-Type': 'application/rss+xml; charset=utf-8',
			'Cache-Control': 'public, max-age=0, must-revalidate'
		}
	})
}
