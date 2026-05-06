import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { fetchBlogIndex, getLatestBlogItem, normalizeBlogIndexItems } from './use-blog-index.ts'

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

	it('读取成功后会过滤无效索引项并归一化标签', async () => {
		const restoreFetch = mockFetchResponse({
			ok: true,
			status: 200,
			json: async () => [
				{ slug: 'valid', title: 'Valid', date: '2026-04-01T00:00:00.000Z', tags: ['a', 1, 'b'], hidden: 'false', favorite: true },
				{ slug: 'bad-date', title: 'Bad Date', date: 'not-a-date', tags: ['x'] },
				{ slug: 'missing-title', date: '2026-04-01T00:00:00.000Z', tags: ['x'] },
				null
			]
		})
		try {
			const items = await fetchBlogIndex('/blogs/index.json')

			assert.deepEqual(items, [
				{
					slug: 'valid',
					title: 'Valid',
					date: '2026-04-01T00:00:00.000Z',
					tags: ['a', 'b'],
					summary: undefined,
					cover: undefined,
					hidden: false,
					category: undefined,
					folderPath: undefined,
					favorite: true
				}
			])
		} finally {
			restoreFetch()
		}
	})
})


describe('normalizeBlogIndexItems', () => {
	it('过滤缺少核心字段、无效日期的索引项并丢弃非字符串可选字段', () => {
		const items = normalizeBlogIndexItems([
			{ slug: 'a', title: 'A', date: '2026-01-01T00:00:00.000Z', tags: ['x', false], summary: 1, folderPath: '/技术', hidden: false },
			{ slug: 'b', title: 'B', tags: [] },
			{ slug: 'bad-date', title: 'Bad Date', date: 'not-a-date', tags: ['x'] },
			'bad'
		])

		assert.deepEqual(items, [
			{
				slug: 'a',
				title: 'A',
				date: '2026-01-01T00:00:00.000Z',
				tags: ['x'],
				summary: undefined,
				cover: undefined,
				hidden: false,
				category: undefined,
				folderPath: '/技术',
				favorite: undefined
			}
		])
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

	it('归一化后计算最新文章不会被无效日期干扰', () => {
		const items = normalizeBlogIndexItems([
			{ slug: 'bad-date', title: 'Bad Date', date: 'not-a-date' },
			{ slug: 'new', title: 'New', date: '2026-02-01T00:00:00.000Z' },
			{ slug: 'old', title: 'Old', date: '2026-01-01T00:00:00.000Z' }
		])

		const latest = getLatestBlogItem(items)

		assert.equal(latest?.slug, 'new')
		assert.deepEqual(
			items.map(item => item.slug),
			['new', 'old']
		)
	})
})
