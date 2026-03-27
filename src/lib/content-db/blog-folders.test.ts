import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildBlogFolderTree } from '@/lib/content-db/blog-folders'

describe('blog folder helpers', () => {
	it('从 folderPath 列表构建稳定树（去重并排序）', () => {
		const tree = buildBlogFolderTree(['/B', '/A/C', '/A/B', '/A/B', 'A/C/', '/A//D'])

		assert.deepEqual(tree, [
			{
				name: 'A',
				path: '/A',
				children: [
					{ name: 'B', path: '/A/B', children: [] },
					{ name: 'C', path: '/A/C', children: [] },
					{ name: 'D', path: '/A/D', children: [] }
				]
			},
			{
				name: 'B',
				path: '/B',
				children: []
			}
		])
	})
})
