import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { syncBlogRuntimeArtifactsToLedger } from './migration-contracts.ts'

describe('migration sync contracts', () => {
	it('sync 会从 runtime artifacts 生成结构化 storage 账本且不触碰 markdown/image', () => {
		const result = syncBlogRuntimeArtifactsToLedger({
			indexRaw: JSON.stringify([
				{
					slug: 'post-a',
					title: 'A',
					tags: ['x'],
					date: '2026-04-12T09:00:00.000Z',
					summary: 'summary',
					category: '技术',
					folderPath: '/写作/技术',
					favorite: true
				}
			]),
			storageRaw: null
		})

		const storage = JSON.parse(result.storageRaw)
		assert.equal(storage.blogs['post-a'].slug, 'post-a')
		assert.equal(storage.blogs['post-a'].favorite, true)
		assert.equal(storage.blogs['post-a'].folderPath, '/写作/技术')
		assert.equal(storage.blogs['post-a'].status, 'published')
		assert.equal(result.touchesMarkdown, false)
		assert.equal(result.touchesImages, false)
		assert.equal(result.atomic, true)
	})

	it('sync 会移除 runtime artifacts 中已删除的博客条目', () => {
		const result = syncBlogRuntimeArtifactsToLedger({
			indexRaw: JSON.stringify([
				{
					slug: 'keep',
					title: 'Keep v2',
					tags: ['x', 'y'],
					date: '2026-04-13T07:00:00.000Z',
					category: '技术',
					folderPath: '/写作/技术'
				}
			]),
			storageRaw: JSON.stringify({
				version: 1,
				updatedAt: '2026-04-13T08:00:00.000Z',
				blogs: {
					keep: {
						slug: 'keep',
						title: 'Keep',
						tags: ['x'],
						date: '2026-04-12T07:00:00.000Z',
						status: 'published'
					},
					'remove-me': {
						slug: 'remove-me',
						title: 'Remove',
						tags: [],
						date: '2026-04-11T07:00:00.000Z',
						status: 'published'
					}
				}
			})
		})

		const storage = JSON.parse(result.storageRaw)
		assert.deepEqual(Object.keys(storage.blogs).sort(), ['keep'])
		assert.equal(storage.blogs.keep.title, 'Keep v2')
		assert.equal(storage.blogs['remove-me'], undefined)
	})
})
