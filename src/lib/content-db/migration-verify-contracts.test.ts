import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { verifyBlogLedgerAgainstRuntime } from './migration-contracts.ts'

describe('migration verify contracts', () => {
	it('当 runtime artifacts 与 ledger 不一致时，返回需要重建的正式产物列表且不触碰 markdown/image', () => {
		const result = verifyBlogLedgerAgainstRuntime({
			storageRaw: JSON.stringify({
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
			}),
			runtimeArtifacts: {
				index: '[]',
				categories: JSON.stringify({ categories: [] }),
				folders: '[]',
				storage: JSON.stringify({ version: 1, updatedAt: '2026-04-12T10:00:00.000Z', blogs: {} })
			}
		})

		assert.deepEqual(result.artifactsToRebuild, [
			'public/blogs/index.json',
			'public/blogs/categories.json',
			'public/blogs/folders.json',
			'public/blogs/storage.json'
		])
		assert.equal(result.touchesMarkdown, false)
		assert.equal(result.touchesImages, false)
		assert.equal(result.atomic, true)
	})
})
