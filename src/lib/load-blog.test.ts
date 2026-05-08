import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const srcRootUrl = new URL('../', import.meta.url)

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
				url: 'data:text/javascript,export default {}'
			}
		}

		if (context.parentURL && specifier.endsWith('site-content.json')) {
			const directUrl = new URL(specifier, context.parentURL)
			if (fileURLToPath(directUrl).endsWith('/src/config/site-content.json')) {
				return {
					shortCircuit: true,
					url: 'data:text/javascript,export default {}'
				}
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

const { loadBlog } = await import('@/lib/load-blog')
const { exportStaticBlogArtifacts, parseBlogStorageDB } = await import('@/lib/content-db/blog-storage')

describe('loadBlog', () => {
	type FetchCall = { input: string; init?: RequestInit }

	async function withMockFetch(responses: Map<string, Response>, run: (calls: FetchCall[]) => Promise<void>) {
		const originalFetch = globalThis.fetch
		const calls: FetchCall[] = []
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const key = typeof input === 'string' ? input : input.toString()
			calls.push({ input: key, init })
			return responses.get(key) ?? new Response(null, { status: 404 })
		}) as typeof fetch

		try {
			await run(calls)
		} finally {
			globalThis.fetch = originalFetch
		}
	}

	it('reads storage, fallback config, and markdown without fetch cache', async () => {
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
				['/blogs/post-a/config.json', new Response('{"title":"Fallback"}', { status: 200 })],
				['/blogs/post-a/index.md', new Response('# hello', { status: 200 })]
			]),
			async calls => {
				await loadBlog('post-a')

				assert.deepEqual(
					calls.map(call => ({ input: call.input, cache: call.init?.cache })),
					[
						{ input: '/blogs/storage.json', cache: 'no-store' },
						{ input: '/blogs/post-a/config.json', cache: 'no-store' },
						{ input: '/blogs/post-a/index.md', cache: 'no-store' }
					]
				)
			}
		)
	})

	it('reads storage-backed markdown without fetch cache', async () => {
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
			async calls => {
				const loaded = await loadBlog('post-a')
				assert.equal(loaded.config.folderPath, '/写作/技术')
				assert.equal(loaded.config.favorite, true)
				assert.deepEqual(
					calls.map(call => ({ input: call.input, cache: call.init?.cache })),
					[
						{ input: '/blogs/storage.json', cache: 'no-store' },
						{ input: '/blogs/post-a/index.md', cache: 'no-store' }
					]
				)
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

	it('aborts when blog storage JSON is malformed', async () => {
		await withMockFetch(
			new Map<string, Response>([
				['/blogs/storage.json', new Response('{bad json', { status: 200 })],
				['/blogs/post-a/config.json', new Response('{"title":"Fallback","tags":["x"],"date":"2026-03-27"}', { status: 200 })],
				['/blogs/post-a/index.md', new Response('# hello', { status: 200 })]
			]),
			async calls => {
				await assert.rejects(() => loadBlog('post-a'), /博客存储格式错误/)

				assert.deepEqual(
					calls.map(call => ({ input: call.input, cache: call.init?.cache })),
					[{ input: '/blogs/storage.json', cache: 'no-store' }]
				)
			}
		)
	})

	it('sanitizes fallback blog config fields before returning them', async () => {
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
				[
					'/blogs/post-a/config.json',
					new Response(
						JSON.stringify({
							title: 'Fallback',
							tags: ['x', 1],
							date: 123,
							cover: '/cover.png',
							hidden: 'no',
							favorite: true
						}),
						{ status: 200 }
					)
				],
				['/blogs/post-a/index.md', new Response('# hello', { status: 200 })]
			]),
			async () => {
				const loaded = await loadBlog('post-a')

				assert.deepEqual(loaded.config, {
					title: 'Fallback',
					cover: '/cover.png',
					favorite: true
				})
			}
		)
	})

	it('aborts when fallback blog config JSON is malformed', async () => {
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
				['/blogs/post-a/config.json', new Response('{bad json', { status: 200 })],
				['/blogs/post-a/index.md', new Response('# hello', { status: 200 })]
			]),
			async () => {
				await assert.rejects(() => loadBlog('post-a'), /博客配置格式错误/)
			}
		)
	})

	it('aborts when fallback blog config JSON is not an object', async () => {
		for (const configBody of ['null', '[]']) {
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
					['/blogs/post-a/config.json', new Response(configBody, { status: 200 })],
					['/blogs/post-a/index.md', new Response('# hello', { status: 200 })]
				]),
				async () => {
					await assert.rejects(() => loadBlog('post-a'), /博客配置格式错误/)
				}
			)
		}
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
