import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildBatchDeleteArtifactContents, buildDeleteArtifactContents } from './delete-blog'

describe('buildDeleteArtifactContents', () => {
	it('远端删除应同时生成 index/categories/folders/storage 四个正式产物内容', async () => {
		const artifacts = await buildDeleteArtifactContents({
			slug: 'post-1',
			readStorageRaw: async () =>
				JSON.stringify({
					version: 1,
					updatedAt: '2026-03-27T10:00:00.000Z',
					blogs: {
						'post-1': {
							slug: 'post-1',
							title: '标题',
							tags: ['a'],
							date: '2026-03-27T10:00:00.000Z',
							category: '分类A',
							folderPath: '/写作/技术',
							favorite: true,
							status: 'published'
						}
					}
				}),
			fallbackReadIndexRaw: async () =>
				JSON.stringify([
					{
						slug: 'post-1',
						title: '标题',
						tags: ['a'],
						date: '2026-03-27T10:00:00.000Z',
						category: '分类A',
						folderPath: '/写作/技术',
						favorite: true
					}
				])
		})

		assert.deepEqual(Object.keys(artifacts).sort(), ['categories', 'folders', 'index', 'storage'])
		assert.deepEqual(JSON.parse(artifacts.index), [])
		assert.deepEqual(JSON.parse(artifacts.categories).categories, [])
		assert.deepEqual(JSON.parse(artifacts.folders), [])
		assert.deepEqual(JSON.parse(artifacts.storage).blogs, {})
	})

	it('远端批量删除应从四个正式产物中移除多个 slug', async () => {
		const artifacts = await buildBatchDeleteArtifactContents({
			slugs: ['post-1', 'post-2', 'post-1'],
			readStorageRaw: async () =>
				JSON.stringify({
					version: 1,
					updatedAt: '2026-03-27T10:00:00.000Z',
					blogs: {
						'post-1': {
							slug: 'post-1',
							title: '标题1',
							tags: ['a'],
							date: '2026-03-27T10:00:00.000Z',
							category: '分类A',
							folderPath: '/写作',
							status: 'published'
						},
						'post-2': {
							slug: 'post-2',
							title: '标题2',
							tags: ['b'],
							date: '2026-03-28T10:00:00.000Z',
							category: '分类B',
							folderPath: '/归档',
							status: 'published'
						},
						'post-3': {
							slug: 'post-3',
							title: '标题3',
							tags: ['c'],
							date: '2026-03-29T10:00:00.000Z',
							category: '分类C',
							folderPath: '/保留',
							status: 'published'
						}
					}
				}),
			fallbackReadIndexRaw: async () => '[]'
		})

		assert.deepEqual(JSON.parse(artifacts.index).map((item: { slug: string }) => item.slug), ['post-3'])
		assert.deepEqual(JSON.parse(artifacts.categories).categories, ['分类C'])
		assert.deepEqual(JSON.parse(artifacts.folders).map((item: { path: string }) => item.path), ['/保留'])
		assert.deepEqual(Object.keys(JSON.parse(artifacts.storage).blogs), ['post-3'])
	})
})
