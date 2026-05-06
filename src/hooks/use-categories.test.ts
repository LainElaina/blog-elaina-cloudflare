import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { fetchCategoriesConfig } from './use-categories.ts'

function mockFetchResponse(response: { ok: boolean; status: number; json?: () => Promise<unknown> }) {
	const originalFetch = globalThis.fetch
	globalThis.fetch = async () => response as Response
	return () => {
		globalThis.fetch = originalFetch
	}
}

describe('fetchCategoriesConfig', () => {
	it('仅在缺少 categories 产物时回退为空配置', async () => {
		const restoreFetch = mockFetchResponse({ ok: false, status: 404 })
		try {
			assert.deepEqual(await fetchCategoriesConfig('/blogs/categories.json'), { categories: [] })
		} finally {
			restoreFetch()
		}
	})

	it('非 404 读取失败会抛错而不是伪装成空 categories', async () => {
		const restoreFetch = mockFetchResponse({ ok: false, status: 500 })
		try {
			await assert.rejects(fetchCategoriesConfig('/blogs/categories.json'), (error: any) => {
				assert.equal(error.status, 500)
				return true
			})
		} finally {
			restoreFetch()
		}
	})

	it('会清理分类中的空白、空项和重复值', async () => {
		const restoreFetch = mockFetchResponse({
			ok: true,
			status: 200,
			json: async () => ({ categories: [' 技术 ', '', '技术', '  ', '生活', 1, '生活 '] })
		})
		try {
			assert.deepEqual(await fetchCategoriesConfig('/blogs/categories.json'), { categories: ['技术', '生活'] })
		} finally {
			restoreFetch()
		}
	})
})
