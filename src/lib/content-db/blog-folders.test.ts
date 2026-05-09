import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildBlogFolderTree, dedupeAndSortFolderPaths } from './blog-folders.ts'

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

	it('归一化目录路径时会裁剪每段空格并去重', () => {
		assert.deepEqual(dedupeAndSortFolderPaths([' /design / icons ', '/design/icons', '/ design//icons/ ']), [
			'/design/icons'
		])
	})
})
