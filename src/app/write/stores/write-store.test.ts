import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { useWriteStore } from './write-store'

describe('useWriteStore.loadBlogForEdit', () => {
	const originalFetch = globalThis.fetch

	beforeEach(() => {
		useWriteStore.getState().reset()
	})

	afterEach(() => {
		globalThis.fetch = originalFetch
		useWriteStore.getState().reset()
	})

	it('将 folderPath 与 favorite 注入表单状态', async () => {
		const responses = new Map<string, Response>([
			[
				'/blogs/storage.json',
				new Response(
					JSON.stringify({
						version: 1,
						updatedAt: '2026-03-27T10:00:00.000Z',
						blogs: {
							'post-a': {
								slug: 'post-a',
								title: 'A',
								tags: ['x'],
								date: '2026-03-27T09:00:00.000Z',
								folderPath: '/写作/技术',
								favorite: true,
								status: 'published'
							}
						}
					}),
					{ status: 200 }
				)
			],
			['/blogs/post-a/index.md', new Response('# hello', { status: 200 })],
			['/blogs/post-a/config.json', new Response('{}', { status: 200 })]
		])

		globalThis.fetch = (async (input: RequestInfo | URL) => {
			const key = typeof input === 'string' ? input : input.toString()
			return responses.get(key) ?? new Response(null, { status: 404 })
		}) as typeof fetch

		await useWriteStore.getState().loadBlogForEdit('post-a')

		const { form } = useWriteStore.getState()
		assert.equal(form.folderPath, '/写作/技术')
		assert.equal(form.favorite, true)
	})
})
