import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { rebuildBlogRuntimeArtifactsFromStorage } from './migration-contracts.ts'

describe('migration contracts', () => {
	it('rebuild 会一次性返回四个博客正式产物且不触碰 markdown/image', () => {
		const result = rebuildBlogRuntimeArtifactsFromStorage(
			JSON.stringify({
				version: 1,
				updatedAt: '2026-04-12T10:00:00.000Z',
				blogs: {
					'post-a': {
						slug: 'post-a',
						title: 'A',
						tags: ['x'],
						date: '2026-04-12T09:00:00.000Z',
						category: '技术',
						folderPath: '/写作/技术',
						favorite: true,
						status: 'published'
					}
				}
			})
		)

		assert.deepEqual(Object.keys(result.artifacts).sort(), ['categories', 'folders', 'index', 'storage'])
		assert.equal(JSON.parse(result.artifacts.index)[0].slug, 'post-a')
		assert.deepEqual(JSON.parse(result.artifacts.categories).categories, ['技术'])
		const folders = JSON.parse(result.artifacts.folders) as Array<{ path: string; children?: Array<{ path: string }> }>
		assert.equal(folders[0].path, '/写作')
		assert.equal(folders[0].children?.[0]?.path, '/写作/技术')
		assert.equal(JSON.parse(result.artifacts.storage).blogs['post-a'].favorite, true)
		assert.equal(result.touchesMarkdown, false)
		assert.equal(result.touchesImages, false)
		assert.equal(result.atomic, true)
	})
})
