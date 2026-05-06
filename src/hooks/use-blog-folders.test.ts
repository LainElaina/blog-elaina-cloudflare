import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { fetchBlogFoldersConfig, parseBlogFoldersConfig } from './use-blog-folders.ts'

function mockFetchResponse(response: { ok: boolean; status: number; json?: () => Promise<unknown> }) {
	const originalFetch = globalThis.fetch
	globalThis.fetch = async () => response as Response
	return () => {
		globalThis.fetch = originalFetch
	}
}

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

	it('保留旧格式回退行为并清理空白重复路径', () => {
		assert.deepEqual(parseBlogFoldersConfig([' /a ', '/a', '', '  ', '/b']).folders, ['/a', '/b'])
		assert.deepEqual(parseBlogFoldersConfig({ folders: [' /x ', '/x', '/y '] }).folders, ['/x', '/y'])
		assert.deepEqual(parseBlogFoldersConfig({}).folders, [])
	})
})

describe('fetchBlogFoldersConfig', () => {
	it('仅在缺少 folders 产物时回退为空配置', async () => {
		const restoreFetch = mockFetchResponse({ ok: false, status: 404 })
		try {
			assert.deepEqual(await fetchBlogFoldersConfig('/blogs/folders.json'), { folders: [] })
		} finally {
			restoreFetch()
		}
	})

	it('非 404 读取失败会抛错而不是伪装成空 folders', async () => {
		const restoreFetch = mockFetchResponse({ ok: false, status: 500 })
		try {
			await assert.rejects(fetchBlogFoldersConfig('/blogs/folders.json'), (error: any) => {
				assert.equal(error.status, 500)
				return true
			})
		} finally {
			restoreFetch()
		}
	})
})
