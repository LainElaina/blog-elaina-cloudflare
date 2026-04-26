import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import blogIndex from '@/../public/blogs/index.json'
import { siteMetadata } from '@/app/site-metadata'
import { GET as getRss } from '@/app/rss.xml/route'
import sitemap from '@/app/sitemap'
import { CANONICAL_SITE_ORIGIN, getSiteOrigin, toAbsoluteSiteUrl } from './site-origin'

describe('site origin helper', () => {
	it('fixes the canonical site origin to blog.lainelaina.top', () => {
		assert.equal(CANONICAL_SITE_ORIGIN, 'https://blog.lainelaina.top')
		assert.equal(getSiteOrigin(), 'https://blog.lainelaina.top')
	})

	it('builds absolute URLs from canonical paths', () => {
		assert.equal(toAbsoluteSiteUrl('/rss.xml'), 'https://blog.lainelaina.top/rss.xml')
		assert.equal(toAbsoluteSiteUrl('blog/post-a'), 'https://blog.lainelaina.top/blog/post-a')
	})
})

describe('site canonical URL generation', () => {
	it('sets metadataBase from the canonical site origin', () => {
		assert.equal(siteMetadata.metadataBase?.toString(), 'https://blog.lainelaina.top/')
	})

	it('uses the canonical site origin in sitemap output', async () => {
		const entries = await sitemap()
		assert.ok(entries.length > 0)
		assert.equal(
			entries.every(entry => entry.url?.startsWith('https://blog.lainelaina.top')),
			true
		)
		assert.equal(
			entries.some(entry => entry.url?.includes('localhost')),
			false
		)
	})

	it('does not fabricate current timestamps for invalid sitemap dates', async () => {
		const invalidPost = {
			slug: 'invalid-date-post',
			date: 'not-a-real-date'
		}

		;(blogIndex as Array<{ slug: string; date?: string }>).push(invalidPost)

		try {
			const entries = await sitemap()
			const entry = entries.find(item => item.url === toAbsoluteSiteUrl(`/blog/${invalidPost.slug}`))

			assert.ok(entry)
			assert.equal(entry.lastModified, undefined)
		} finally {
			;(blogIndex as Array<{ slug: string; date?: string }>).pop()
		}
	})

	it('uses the canonical site origin in rss output', async () => {
		const response = getRss()
		const xml = await response.text()
		const hasAnyPost = (blogIndex as Array<{ slug?: string }>).some(item => Boolean(item.slug))

		assert.equal(hasAnyPost, true)
		assert.match(xml, /https:\/\/blog\.lainelaina\.top\/rss\.xml/)
		assert.match(xml, /https:\/\/blog\.lainelaina\.top<\/link>/)
		assert.doesNotMatch(xml, /<pubDate><pubDate>/)
		assert.match(xml, /https:\/\/blog\.lainelaina\.top\/blog\//)
		assert.doesNotMatch(xml, /<enclosure\b/)
		assert.doesNotMatch(xml, /www\.yysuni\.com/)
	})
})
