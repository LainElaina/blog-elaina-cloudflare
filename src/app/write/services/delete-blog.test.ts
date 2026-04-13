import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildDeleteArtifactContents } from './delete-blog.ts'

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
})
