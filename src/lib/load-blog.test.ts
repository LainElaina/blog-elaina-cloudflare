import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { loadBlog } from '@/lib/load-blog'
import { exportStaticBlogArtifacts, parseBlogStorageDB } from '@/lib/content-db/blog-storage'

describe('loadBlog', () => {
	async function withMockFetch(responses: Map<string, Response>, run: () => Promise<void>) {
		const originalFetch = globalThis.fetch
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			const key = typeof input === 'string' ? input : input.toString()
			return responses.get(key) ?? new Response(null, { status: 404 })
		}) as typeof fetch

		try {
			await run()
		} finally {
			globalThis.fetch = originalFetch
		}
	}

	it('reads folderPath and favorite from storage', async () => {
		await withMockFetch(
			new Map<string, Response>([
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
			]),
			async () => {
				const loaded = await loadBlog('post-a')
				assert.equal(loaded.config.folderPath, '/写作/技术')
				assert.equal(loaded.config.favorite, true)
			}
		)
	})

	it('aborts when blog storage read fails before falling back to config', async () => {
		await withMockFetch(
			new Map<string, Response>([
				['/blogs/storage.json', new Response('temporary failure', { status: 500 })],
				['/blogs/post-a/config.json', new Response('{"title":"Fallback"}', { status: 200 })],
				['/blogs/post-a/index.md', new Response('# hello', { status: 200 })]
			]),
			async () => {
				await assert.rejects(() => loadBlog('post-a'), /读取博客存储失败：temporary failure/)
			}
		)
	})

	it('aborts when fallback blog config read fails', async () => {
		await withMockFetch(
			new Map<string, Response>([
				[
					'/blogs/storage.json',
					new Response(
						JSON.stringify({
							version: 1,
							updatedAt: '2026-03-27T10:00:00.000Z',
							blogs: {}
						}),
						{ status: 200 }
					)
				],
				['/blogs/post-a/config.json', new Response('temporary failure', { status: 500 })],
				['/blogs/post-a/index.md', new Response('# hello', { status: 200 })]
			]),
			async () => {
				await assert.rejects(() => loadBlog('post-a'), /读取博客配置失败：temporary failure/)
			}
		)
	})

	it('keeps missing markdown as not found while surfacing read failures', async () => {
		await withMockFetch(new Map<string, Response>(), async () => {
			await assert.rejects(() => loadBlog('post-a'), /Blog not found/)
		})

		await withMockFetch(
			new Map<string, Response>([
				['/blogs/post-a/index.md', new Response('temporary failure', { status: 500 })]
			]),
			async () => {
				await assert.rejects(() => loadBlog('post-a'), /读取博客 Markdown失败：temporary failure/)
			}
		)
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
