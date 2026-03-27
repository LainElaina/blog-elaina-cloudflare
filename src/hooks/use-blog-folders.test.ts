import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { parseBlogFoldersConfig } from './use-blog-folders.ts'

describe('use-blog-folders parser', () => {
	it('支持 BlogFolderNode[] 树结构并扁平化为路径选项', () => {
		const data = [
			{
				name: 'tech',
				path: '/tech',
				children: [
					{ name: 'web', path: '/tech/web', children: [] },
					{
						name: 'ai',
						path: '/tech/ai',
						children: [{ name: 'llm', path: '/tech/ai/llm', children: [] }]
					}
				]
			},
			{ name: 'life', path: '/life', children: [] }
		]

		assert.deepEqual(parseBlogFoldersConfig(data).folders, [
			'/tech',
			'/tech/web',
			'/tech/ai',
			'/tech/ai/llm',
			'/life'
		])
	})

	it('保留旧格式回退行为', () => {
		assert.deepEqual(parseBlogFoldersConfig(['/a', '/b']).folders, ['/a', '/b'])
		assert.deepEqual(parseBlogFoldersConfig({ folders: ['/x', '/y'] }).folders, ['/x', '/y'])
		assert.deepEqual(parseBlogFoldersConfig({}).folders, [])
	})
})
