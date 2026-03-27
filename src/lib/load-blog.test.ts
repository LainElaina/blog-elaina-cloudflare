import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { loadBlog } from '@/lib/load-blog'
import { exportStaticBlogArtifacts, parseBlogStorageDB } from '@/lib/content-db/blog-storage'

describe('loadBlog', () => {
	it('reads folderPath and favorite from storage', async () => {
		const originalFetch = globalThis.fetch
		const responses = new Map<string, Response>([
			[
				'/blogs/storage.json',
				new Response(
					JSON.stringify({
						version: 1,
						updatedAt: '2026-03-27T10:00:00.000Z',
						blogs: {
							'post-a': {
								slug: 'post-a',
								title: 'A',
								tags: ['x'],
								date: '2026-03-27T09:00:00.000Z',
								folderPath: '/写作/技术',
								favorite: true,
								status: 'published'
							}
						}
					}),
					{ status: 200 }
				)
			],
			['/blogs/post-a/index.md', new Response('# hello', { status: 200 })],
			['/blogs/post-a/config.json', new Response('{}', { status: 200 })]
		])
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			const key = typeof input === 'string' ? input : input.toString()
			return responses.get(key) ?? new Response(null, { status: 404 })
		}) as typeof fetch

		try {
			const loaded = await loadBlog('post-a')
			assert.equal(loaded.config.folderPath, '/写作/技术')
			assert.equal(loaded.config.favorite, true)
		} finally {
			globalThis.fetch = originalFetch
		}
	})
})

describe('export artifacts', () => {
	it('only published records participate in index/favorite consumption', () => {
		const db = parseBlogStorageDB(
			JSON.stringify({
				version: 1,
				updatedAt: '2026-03-27T10:00:00.000Z',
				blogs: {
					published: {
						slug: 'published',
						title: 'Published',
						tags: [],
						date: '2026-03-27T09:00:00.000Z',
						favorite: true,
						status: 'published'
					},
					draft: {
						slug: 'draft',
						title: 'Draft',
						tags: [],
						date: '2026-03-27T08:00:00.000Z',
						favorite: true,
						status: 'draft'
					}
				}
			})
		)

		const artifacts = exportStaticBlogArtifacts(db)
		assert.deepEqual(artifacts.index.map(item => item.slug), ['published'])
		assert.deepEqual(
			artifacts.index.map(item => ({ slug: item.slug, favorite: item.favorite })),
			[{ slug: 'published', favorite: true }]
		)
	})
})
