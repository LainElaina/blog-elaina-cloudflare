import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const srcRootUrl = new URL('../', import.meta.url)
const blogIndexJson = readFileSync(fileURLToPath(new URL('../../public/blogs/index.json', import.meta.url)), 'utf-8')
const siteContentModuleUrl = 'data:text/javascript,export default { meta: {} }'
const blogIndexModuleUrl = `data:text/javascript,${encodeURIComponent(`export default ${blogIndexJson}`)}`

function resolveProjectModule(baseUrl: URL, specifier: string) {
	const directUrl = new URL(specifier, baseUrl)
	if (existsSync(fileURLToPath(directUrl))) {
		return directUrl.href
	}

	for (const extension of ['.ts', '.tsx', '.js', '.jsx', '.json']) {
		const url = new URL(`${specifier}${extension}`, baseUrl)
		if (existsSync(fileURLToPath(url))) {
			return url.href
		}
	}

	return null
}

registerHooks({
	resolve(specifier, context, nextResolve) {
		if (specifier === '@/config/site-content.json') {
			return {
				shortCircuit: true,
				url: siteContentModuleUrl
			}
		}

		if (specifier === '@/../public/blogs/index.json') {
			return {
				shortCircuit: true,
				url: blogIndexModuleUrl
			}
		}

		if (specifier.startsWith('@/')) {
			const url = resolveProjectModule(srcRootUrl, specifier.slice(2))
			if (url) return { shortCircuit: true, url }
		}

		if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL) {
			const url = resolveProjectModule(new URL(context.parentURL), specifier)
			if (url) return { shortCircuit: true, url }
		}

		return nextResolve(specifier, context)
	}
})

const blogIndex = (await import('@/../public/blogs/index.json')).default as Array<{
	slug?: string
	title?: string
	date?: string
	hidden?: boolean
}>
const { siteMetadata } = await import('@/app/site-metadata')
const { GET: getRss } = await import('@/app/rss.xml/route')
const { buildSitemapEntries, default: sitemap } = await import('@/app/sitemap')
const { MAX_FEED_ITEMS } = await import('@/app/rss.xml/rss-utils')
const { CANONICAL_SITE_ORIGIN, getSiteOrigin, toAbsoluteSiteUrl } = await import('./site-origin')

describe('site origin helper', () => {
	it('fixes the canonical site origin to blog.lainelaina.top', () => {
		assert.equal(CANONICAL_SITE_ORIGIN, 'https://blog.lainelaina.top')
		assert.equal(getSiteOrigin(), 'https://blog.lainelaina.top')
	})

	it('builds absolute URLs from canonical paths', () => {
		assert.equal(toAbsoluteSiteUrl('/rss.xml'), 'https://blog.lainelaina.top/rss.xml')
		assert.equal(toAbsoluteSiteUrl('blog/post-a'), 'https://blog.lainelaina.top/blog/post-a')
		assert.equal(toAbsoluteSiteUrl('/blog/post-a', 'https://preview.example/'), 'https://preview.example/blog/post-a')
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

	it('applies custom sitemap origin to encoded blog URLs', () => {
		const entries = buildSitemapEntries([{ slug: 'Blog CF1', date: '2026-01-01T00:00:00.000Z' }], 'https://preview.example/')

		assert.deepEqual(
			entries.map(entry => entry.url),
			['https://preview.example', 'https://preview.example/blog/Blog%20CF1']
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
		const hasAnyPost = (blogIndex as Array<{ slug?: string }>).some(item => Boolean(item.slug) && !item.hidden)

		assert.equal(hasAnyPost, true)
		assert.match(xml, /https:\/\/blog\.lainelaina\.top\/rss\.xml/)
		assert.match(xml, /https:\/\/blog\.lainelaina\.top<\/link>/)
		assert.doesNotMatch(xml, /<pubDate><pubDate>/)
		assert.match(xml, /https:\/\/blog\.lainelaina\.top\/blog\//)
		assert.doesNotMatch(xml, /<enclosure\b/)
		assert.doesNotMatch(xml, /www\.yysuni\.com/)
	})

	it('excludes hidden blog posts from sitemap and rss output', async () => {
		const hiddenPost = {
			slug: 'hidden-index-test-post',
			title: 'Hidden Index Test Post',
			hidden: true
		}

		;(blogIndex as Array<{ slug: string; title?: string; hidden?: boolean }>).push(hiddenPost)

		try {
			const entries = await sitemap()
			const rssXml = await getRss().text()

			assert.equal(entries.some(item => item.url === toAbsoluteSiteUrl(`/blog/${hiddenPost.slug}`)), false)
			assert.doesNotMatch(rssXml, /hidden-index-test-post/)
			assert.doesNotMatch(rssXml, /Hidden Index Test Post/)
		} finally {
			;(blogIndex as Array<{ slug: string; title?: string; hidden?: boolean }>).pop()
		}
	})

	it('ignores malformed sitemap blog index data instead of failing generation', () => {
		const entriesFromObject = buildSitemapEntries({ blogs: [] })
		assert.deepEqual(
			entriesFromObject.map(entry => entry.url),
			[getSiteOrigin()]
		)

		const entries = buildSitemapEntries([
			null,
			{ slug: 'valid-post', date: '2026-01-01T00:00:00.000Z' },
			{ slug: '', date: '2026-01-01T00:00:00.000Z' },
			{ slug: 'bad/slash', date: '2026-01-01T00:00:00.000Z' },
			{ slug: 'bad\\slash', date: '2026-01-01T00:00:00.000Z' },
			{ slug: String.fromCharCode(0xd800), date: '2026-01-01T00:00:00.000Z' },
			{ title: 'missing slug' },
			{ slug: 'hidden-post', hidden: true }
		])

		assert.equal(entries.some(entry => entry.url === toAbsoluteSiteUrl('/blog/valid-post')), true)
		assert.equal(entries.some(entry => entry.url === toAbsoluteSiteUrl('/blog/bad%2Fslash')), false)
		assert.equal(entries.some(entry => entry.url === toAbsoluteSiteUrl('/blog/bad%5Cslash')), false)
		assert.equal(entries.some(entry => entry.url === toAbsoluteSiteUrl('/blog/hidden-post')), false)
	})

	it('limits sitemap blog entries generated from oversized indexes', () => {
		const entries = buildSitemapEntries(
			Array.from({ length: MAX_FEED_ITEMS + 2 }, (_, index) => ({
				slug: `oversized-post-${index}`,
				date: '2026-01-01T00:00:00.000Z'
			}))
		)

		assert.equal(entries.length, MAX_FEED_ITEMS + 1)
		assert.equal(entries.some(entry => entry.url === toAbsoluteSiteUrl('/blog/oversized-post-0')), true)
		assert.equal(entries.some(entry => entry.url === toAbsoluteSiteUrl(`/blog/oversized-post-${MAX_FEED_ITEMS}`)), false)
	})
})
