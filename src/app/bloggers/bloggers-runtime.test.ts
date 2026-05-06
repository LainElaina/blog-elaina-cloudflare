import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { normalizeBloggersRuntimeItems } from './bloggers-runtime.ts'

describe('bloggers-runtime', () => {
	it('顶层不是数组时返回空博主列表', () => {
		assert.deepEqual(normalizeBloggersRuntimeItems(null), [])
		assert.deepEqual(normalizeBloggersRuntimeItems({ items: [] }), [])
	})

	it('过滤无效博主并归一化可选字段', () => {
		const bloggers = normalizeBloggersRuntimeItems([
			null,
			[],
			{ name: 'missing url', avatar: '/avatar.png', description: 'desc', stars: 5 },
			{
				name: 'Valid Blogger',
				avatar: '/avatar.png',
				url: 'https://example.com',
				description: 'desc',
				stars: Number.NaN,
				status: 'recent'
			},
			{
				name: 'Unknown Status',
				avatar: '/avatar-2.png',
				url: 'https://unknown.example.com',
				description: 'desc',
				stars: 4,
				status: 'archived'
			}
		])

		assert.deepEqual(bloggers, [
			{
				name: 'Valid Blogger',
				avatar: '/avatar.png',
				url: 'https://example.com',
				description: 'desc',
				stars: 0,
				status: 'recent'
			},
			{
				name: 'Unknown Status',
				avatar: '/avatar-2.png',
				url: 'https://unknown.example.com',
				description: 'desc',
				stars: 4
			}
		])
	})
})
