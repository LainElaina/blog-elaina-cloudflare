import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	buildBlogStorageFromIndex,
	exportStaticBlogArtifacts,
	upsertBlogRecord,
	createEmptyBlogStorageDB,
	parseBlogStorageDB,
	parseRequiredBlogStorageDB
} from '@/lib/content-db/blog-storage'
import { prepareBlogStaticArtifacts, prepareBlogStorageArtifacts, serializeCategoriesConfig } from '@/lib/blog-index'
import { loadBlog } from '@/lib/load-blog'
import { buildArtifactsForSaveBlogEdits } from '@/app/blog/services/save-blog-edits'

import type { BlogIndexItem } from '@/app/blog/types'

describe('blog storage model', () => {
	it('仅将元数据写入数据库，不包含 Markdown 正文', () => {
		const item: BlogIndexItem = {
			slug: 'post-1',
			title: '标题',
			tags: ['t1'],
			date: '2026-03-27T10:00:00.000Z',
			summary: '摘要',
			category: '分类A'
		}
		const db = upsertBlogRecord(createEmptyBlogStorageDB(new Date('2026-03-27T10:00:00.000Z')), item, {
			folder: 'default',
			status: 'published',
			now: new Date('2026-03-27T10:00:00.000Z')
		})

		const record = db.blogs['post-1'] as Record<string, unknown>
		assert.equal(record.slug, 'post-1')
		assert.equal(record.folder, 'default')
		assert.equal(record.status, 'published')
		assert.ok(!Object.prototype.hasOwnProperty.call(record, 'markdown'))
		assert.ok(!Object.prototype.hasOwnProperty.call(record, 'md'))
	})


	it('storage record 保留 folderPath 与 favorite 字段', () => {
		const item: BlogIndexItem = {
			slug: 'with-folder-fav',
			title: '带目录与精选',
			tags: ['fav'],
			date: '2026-03-27T10:10:00.000Z',
			folderPath: '/写作/技术',
			favorite: true
		}
		const db = upsertBlogRecord(createEmptyBlogStorageDB(new Date('2026-03-27T10:10:00.000Z')), item, {
			folder: 'default',
			status: 'published',
			now: new Date('2026-03-27T10:10:00.000Z')
		})

		const record = db.blogs['with-folder-fav']
		assert.equal(record.folderPath, '/写作/技术')
		assert.equal(record.favorite, true)
	})

	it('导出静态产物保留 favorite 并暴露 folders', () => {
		const input: BlogIndexItem[] = [
			{ slug: 'fav-1', title: 'Fav 1', tags: [], date: '2026-02-01T00:00:00.000Z', folderPath: '/A/B', favorite: true },
			{ slug: 'fav-2', title: 'Fav 2', tags: [], date: '2026-01-01T00:00:00.000Z', folderPath: '/A/C' }
		]
		const db = buildBlogStorageFromIndex(input, new Date('2026-03-27T00:00:00.000Z'))
		const artifacts = exportStaticBlogArtifacts(db)

		assert.deepEqual(
			artifacts.index.map(item => ({ slug: item.slug, favorite: item.favorite })),
			[
				{ slug: 'fav-1', favorite: true },
				{ slug: 'fav-2', favorite: false }
			]
		)
		assert.deepEqual(artifacts.folders, [
			{
				name: 'A',
				path: '/A',
				children: [
					{ name: 'B', path: '/A/B', children: [] },
					{ name: 'C', path: '/A/C', children: [] }
				]
			}
		])
	})


	it('parseBlogStorageDB 会最小化清洗非法字段形状', () => {
		const db = parseBlogStorageDB(
			JSON.stringify({
				version: 1,
				updatedAt: '2026-03-27T00:00:00.000Z',
				blogs: {
					dirty: {
						slug: 'dirty',
						title: 'Dirty',
						tags: ['ok', 1],
						date: '2026-01-02T00:00:00.000Z',
						folderPath: '   ',
						favorite: 'yes',
						status: 'unknown'
					},
					clean: {
						slug: 'clean',
						title: 'Clean',
						tags: ['a', 'b'],
						date: '2026-01-03T00:00:00.000Z',
						folderPath: ' /写作/技术 ',
						favorite: true,
						status: 'draft'
					}
				}
			})
		)

		assert.deepEqual(db.blogs.dirty.tags, [])
		assert.equal(db.blogs.dirty.status, 'published')
		assert.equal(db.blogs.dirty.favorite, false)
		assert.equal(db.blogs.dirty.folderPath, undefined)

		assert.deepEqual(db.blogs.clean.tags, ['a', 'b'])
		assert.equal(db.blogs.clean.status, 'draft')
		assert.equal(db.blogs.clean.favorite, true)
		assert.equal(db.blogs.clean.folderPath, '/写作/技术')
	})

	it('parseRequiredBlogStorageDB 会拒绝不安全或不一致的 storage slug', () => {
		for (const blogs of [
			{
				'Post-A': {
					slug: 'Post-A',
					title: 'Uppercase',
					tags: [],
					date: '2026-03-27T10:00:00.000Z',
					status: 'published'
				}
			},
			{
				'post-a': {
					slug: 'post-b',
					title: 'Mismatch',
					tags: [],
					date: '2026-03-27T10:00:00.000Z',
					status: 'published'
				}
			}
		]) {
			assert.throws(
				() =>
					parseRequiredBlogStorageDB(
						JSON.stringify({
							version: 1,
							updatedAt: '2026-03-27T10:00:00.000Z',
							blogs
						})
					),
				/博客 storage\.json 解析失败/
			)
		}
	})

	it('loadBlog 优先消费 storage.json 元数据并读取 Markdown 正文', async () => {
		const originalFetch = globalThis.fetch
		const responses = new Map<string, Response>([
			[
				'/blogs/storage.json',
				new Response(
					JSON.stringify({
						version: 1,
						updatedAt: '2026-03-27T10:00:00.000Z',
						blogs: {
							'storage-first': {
								slug: 'storage-first',
								title: '来自 storage',
								tags: ['db'],
								date: '2026-03-27T09:00:00.000Z',
								summary: 'storage summary',
								cover: '/cover-storage.png',
								status: 'published'
							}
						}
					}),
					{ status: 200 }
				)
			],
			[
				'/blogs/storage-first/index.md',
				new Response('# hello', { status: 200 })
			],
			[
				'/blogs/storage-first/config.json',
				new Response(
					JSON.stringify({
						title: '来自 config',
						tags: ['legacy'],
						date: '1999-01-01T00:00:00.000Z'
					}),
					{ status: 200 }
				)
			]
		])
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			const key = typeof input === 'string' ? input : input.toString()
			return responses.get(key) ?? new Response(null, { status: 404 })
		}) as typeof fetch
		try {
			const loaded = await loadBlog('storage-first')
			assert.equal(loaded.config.title, '来自 storage')
			assert.deepEqual(loaded.config.tags, ['db'])
			assert.equal(loaded.cover, '/cover-storage.png')
			assert.equal(loaded.markdown, '# hello')
		} finally {
			globalThis.fetch = originalFetch
		}
	})

	it('loadBlog 在 storage 缺失时回退到 config.json', async () => {
		const originalFetch = globalThis.fetch
		const responses = new Map<string, Response>([
			['/blogs/storage.json', new Response(null, { status: 404 })],
			[
				'/blogs/fallback-missing/config.json',
				new Response(
					JSON.stringify({
						title: '来自 config fallback',
						tags: ['legacy'],
						date: '2026-03-27T09:30:00.000Z',
						cover: '/cover-fallback.png'
					}),
					{ status: 200 }
				)
			],
			['/blogs/fallback-missing/index.md', new Response('# fallback missing storage', { status: 200 })]
		])
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			const key = typeof input === 'string' ? input : input.toString()
			return responses.get(key) ?? new Response(null, { status: 404 })
		}) as typeof fetch
		try {
			const loaded = await loadBlog('fallback-missing')
			assert.equal(loaded.config.title, '来自 config fallback')
			assert.deepEqual(loaded.config.tags, ['legacy'])
			assert.equal(loaded.cover, '/cover-fallback.png')
			assert.equal(loaded.markdown, '# fallback missing storage')
		} finally {
			globalThis.fetch = originalFetch
		}
	})

	it('loadBlog 在 storage 损坏时会失败而不是回退到 config.json', async () => {
		const originalFetch = globalThis.fetch
		const responses = new Map<string, Response>([
			['/blogs/storage.json', new Response('{invalid json', { status: 200 })],
			[
				'/blogs/fallback-broken/config.json',
				new Response(
					JSON.stringify({
						title: '来自损坏回退',
						tags: ['broken-storage'],
						date: '2026-03-27T09:40:00.000Z'
					}),
					{ status: 200 }
				)
			],
			['/blogs/fallback-broken/index.md', new Response('# fallback broken storage', { status: 200 })]
		])
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			const key = typeof input === 'string' ? input : input.toString()
			return responses.get(key) ?? new Response(null, { status: 404 })
		}) as typeof fetch
		try {
			await assert.rejects(() => loadBlog('fallback-broken'), /博客存储格式错误/)
		} finally {
			globalThis.fetch = originalFetch
		}
	})

	it('loadBlog 在 storage 未命中 slug 时回退到 config.json', async () => {
		const originalFetch = globalThis.fetch
		const responses = new Map<string, Response>([
			[
				'/blogs/storage.json',
				new Response(
					JSON.stringify({
						version: 1,
						updatedAt: '2026-03-27T10:00:00.000Z',
						blogs: {
							other: {
								slug: 'other',
								title: 'other title',
								tags: ['other'],
								date: '2026-03-27T09:00:00.000Z'
							}
						}
					}),
					{ status: 200 }
				)
			],
			[
				'/blogs/fallback-miss-slug/config.json',
				new Response(
					JSON.stringify({
						title: '来自未命中回退',
						tags: ['miss-slug'],
						date: '2026-03-27T09:50:00.000Z'
					}),
					{ status: 200 }
				)
			],
			['/blogs/fallback-miss-slug/index.md', new Response('# fallback miss slug', { status: 200 })]
		])
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			const key = typeof input === 'string' ? input : input.toString()
			return responses.get(key) ?? new Response(null, { status: 404 })
		}) as typeof fetch
		try {
			const loaded = await loadBlog('fallback-miss-slug')
			assert.equal(loaded.config.title, '来自未命中回退')
			assert.deepEqual(loaded.config.tags, ['miss-slug'])
			assert.equal(loaded.markdown, '# fallback miss slug')
		} finally {
			globalThis.fetch = originalFetch
		}
	})

	it('categories.json 统一输出为对象 schema', async () => {
		const artifacts = await prepareBlogStaticArtifacts({
			readStorageRaw: async () =>
				JSON.stringify({
					version: 1,
					updatedAt: '2026-03-27T12:00:00.000Z',
					blogs: {
						a: { slug: 'a', title: 'A', tags: [], date: '2026-03-27T10:00:00.000Z', category: 'X', status: 'published' }
					}
				})
		})
		assert.equal(serializeCategoriesConfig(artifacts.categories), JSON.stringify({ categories: ['X'] }, null, 2))
	})

	it('写入正式产物时遇到损坏 storage 会失败而不是回退覆盖', async () => {
		await assert.rejects(
			() =>
				prepareBlogStaticArtifacts({
					readStorageRaw: async () => '{invalid json',
					fallbackReadIndexRaw: async () =>
						JSON.stringify([{ slug: 'from-index', title: 'From Index', tags: [], date: '2026-03-27T00:00:00.000Z' }])
				}),
			/博客 storage\.json 解析失败/
		)
	})

	it('storage 缺失但 index 损坏时会失败而不是重建空库', async () => {
		await assert.rejects(
			() =>
				prepareBlogStaticArtifacts({
					readStorageRaw: async () => null,
					fallbackReadIndexRaw: async () => '{invalid json'
				}),
			/博客 index\.json 解析失败/
		)
	})

	it('storage 缺失但 index 不是数组时会失败而不是重建空库', async () => {
		await assert.rejects(
			() =>
				prepareBlogStaticArtifacts({
					readStorageRaw: async () => null,
					fallbackReadIndexRaw: async () => JSON.stringify({ blogs: [] })
				}),
			/博客 index\.json 格式错误/
		)
	})

	it('storage 缺失但 index 元素损坏时会失败而不是生成脏产物', async () => {
		await assert.rejects(
			() =>
				prepareBlogStaticArtifacts({
					readStorageRaw: async () => null,
					fallbackReadIndexRaw: async () => JSON.stringify([null, { slug: '', title: 'Broken', tags: [], date: '2026-03-27T00:00:00.000Z' }])
				}),
			/博客 index\.json 格式错误/
		)
	})

	it('远端 storage 损坏时会失败而不是重建空库', async () => {
		const originalFetch = globalThis.fetch
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			const url = input.toString()
			if (url.includes('public%2Fblogs%2Fstorage.json')) {
				return new Response(JSON.stringify({ content: Buffer.from('{invalid json', 'utf-8').toString('base64') }), { status: 200 })
			}
			return new Response(null, { status: 404 })
		}) as typeof fetch

		try {
			await assert.rejects(() => prepareBlogStorageArtifacts('token', 'owner', 'repo', 'main'), /博客 storage\.json 解析失败/)
		} finally {
			globalThis.fetch = originalFetch
		}
	})

	it('远端 storage 缺失但 index 读取失败时会失败而不是重建空库', async () => {
		const originalFetch = globalThis.fetch
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			const url = input.toString()
			if (url.includes('public%2Fblogs%2Fstorage.json')) {
				return new Response(null, { status: 404 })
			}
			if (url.includes('public%2Fblogs%2Findex.json')) {
				return new Response(null, { status: 500 })
			}
			return new Response(null, { status: 404 })
		}) as typeof fetch

		try {
			await assert.rejects(() => prepareBlogStorageArtifacts('token', 'owner', 'repo', 'main'), /read file failed: 500/)
		} finally {
			globalThis.fetch = originalFetch
		}
	})

	it('远端 storage 缺失但 index 损坏时会失败而不是重建空库', async () => {
		const originalFetch = globalThis.fetch
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			const url = input.toString()
			if (url.includes('public%2Fblogs%2Fstorage.json')) {
				return new Response(null, { status: 404 })
			}
			if (url.includes('public%2Fblogs%2Findex.json')) {
				return new Response(JSON.stringify({ content: Buffer.from('{invalid json', 'utf-8').toString('base64') }), { status: 200 })
			}
			return new Response(null, { status: 404 })
		}) as typeof fetch

		try {
			await assert.rejects(() => prepareBlogStorageArtifacts('token', 'owner', 'repo', 'main'), /博客 index\.json 解析失败/)
		} finally {
			globalThis.fetch = originalFetch
		}
	})

	it('远端 storage 缺失但 index 元素损坏时会失败而不是生成脏产物', async () => {
		const originalFetch = globalThis.fetch
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			const url = input.toString()
			if (url.includes('public%2Fblogs%2Fstorage.json')) {
				return new Response(null, { status: 404 })
			}
			if (url.includes('public%2Fblogs%2Findex.json')) {
				return new Response(JSON.stringify({ content: Buffer.from(JSON.stringify([null]), 'utf-8').toString('base64') }), { status: 200 })
			}
			return new Response(null, { status: 404 })
		}) as typeof fetch

		try {
			await assert.rejects(() => prepareBlogStorageArtifacts('token', 'owner', 'repo', 'main'), /博客 index\.json 格式错误/)
		} finally {
			globalThis.fetch = originalFetch
		}
	})

	it('博客列表保存时遇到损坏 storage 会失败而不是重建空库', () => {
		assert.throws(
			() =>
				buildArtifactsForSaveBlogEdits({
					originalItems: [],
					nextItems: [{ slug: 'new-post', title: 'New', tags: [], date: '2026-03-27T00:00:00.000Z' }],
					categories: [],
					existingStorageRaw: '{invalid json'
				}),
			/博客 storage\.json 解析失败/
		)
	})

	it('编辑与删除后会同步维护 storage/index/categories/folders 产物', () => {
		const originalItems: BlogIndexItem[] = [
			{ slug: 'keep', title: 'Keep', tags: ['x'], date: '2026-03-10T00:00:00.000Z', category: 'A' },
			{ slug: 'remove-me', title: 'Remove', tags: [], date: '2026-03-11T00:00:00.000Z', category: 'B' }
		]
		const nextItems: BlogIndexItem[] = [
			{ slug: 'keep', title: 'Keep v2', tags: ['x', 'y'], date: '2026-03-12T00:00:00.000Z', category: 'C', folderPath: '/写作/技术' }
		]
		const nextCategories = ['C', '历史脏分类']
		const existingStorageRaw = JSON.stringify({
			version: 1,
			updatedAt: '2026-03-01T00:00:00.000Z',
			blogs: {
				keep: {
					slug: 'keep',
					title: 'Keep',
					tags: ['x'],
					date: '2026-03-10T00:00:00.000Z',
					category: 'A',
					status: 'published'
				},
				'remove-me': {
					slug: 'remove-me',
					title: 'Remove',
					tags: [],
					date: '2026-03-11T00:00:00.000Z',
					category: 'B',
					status: 'published'
				}
			}
		})

		const artifacts = buildArtifactsForSaveBlogEdits({
			originalItems,
			nextItems,
			categories: nextCategories,
			existingStorageRaw,
			now: new Date('2026-03-27T12:00:00.000Z')
		})

		assert.deepEqual(artifacts.removedSlugs, ['remove-me'])
		assert.deepEqual(artifacts.index.map(item => item.slug), ['keep'])
		assert.deepEqual(artifacts.categories, ['C', '历史脏分类'])
		assert.deepEqual(artifacts.folders, [
			{
				name: '写作',
				path: '/写作',
				children: [{ name: '技术', path: '/写作/技术', children: [] }]
			}
		])
		assert.ok(artifacts.storage.blogs.keep)
		assert.equal(artifacts.storage.blogs.keep.title, 'Keep v2')
		assert.ok(!artifacts.storage.blogs['remove-me'])
	})
})
