import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { fetchBlogIndex, getLatestBlogItem } from './use-blog-index.ts'

function mockFetchResponse(response: { ok: boolean; status: number; json?: () => Promise<unknown> }) {
	const originalFetch = globalThis.fetch
	globalThis.fetch = async () => response as Response
	return () => {
		globalThis.fetch = originalFetch
	}
}

describe('fetchBlogIndex', () => {
	it('非数组博客索引会抛错而不是伪装成空文章列表', async () => {
		const restoreFetch = mockFetchResponse({ ok: true, status: 200, json: async () => ({ items: [] }) })
		try {
			await assert.rejects(fetchBlogIndex('/blogs/index.json'), /博客索引格式错误/)
		} finally {
			restoreFetch()
		}
	})

	it('读取失败会保留响应状态码', async () => {
		const restoreFetch = mockFetchResponse({ ok: false, status: 500 })
		try {
			await assert.rejects(fetchBlogIndex('/blogs/index.json'), (error: any) => {
				assert.equal(error.status, 500)
				return true
			})
		} finally {
			restoreFetch()
		}
	})
})

describe('getLatestBlogItem', () => {
	it('计算最新文章时不会原地重排传入的索引数组', () => {
		const items = [
			{ slug: 'old', title: 'Old', date: '2026-01-01T00:00:00.000Z' },
			{ slug: 'new', title: 'New', date: '2026-02-01T00:00:00.000Z' }
		] as any[]

		const latest = getLatestBlogItem(items)

		assert.equal(latest?.slug, 'new')
		assert.deepEqual(
			items.map(item => item.slug),
			['old', 'new']
		)
	})
})
