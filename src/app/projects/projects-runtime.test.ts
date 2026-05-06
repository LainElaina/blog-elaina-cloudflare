import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { normalizeProjectRuntimeItems } from './projects-runtime.ts'

describe('projects-runtime', () => {
	it('顶层不是数组时返回空项目列表', () => {
		assert.deepEqual(normalizeProjectRuntimeItems(null), [])
		assert.deepEqual(normalizeProjectRuntimeItems({ items: [] }), [])
	})

	it('过滤无效项目并归一化可选字段', () => {
		const projects = normalizeProjectRuntimeItems([
			null,
			[],
			{ name: 'missing url', image: '/cover.png', description: 'desc', tags: ['tag'] },
			{
				name: 'Valid Project',
				image: '/cover.png',
				url: 'https://example.com',
				description: 'desc',
				tags: ['tool', 1, 'blog', null],
				year: Number.POSITIVE_INFINITY,
				github: 42,
				npm: 'valid-package'
			},
			{
				name: 'No Tags',
				image: '/cover-2.png',
				url: 'https://no-tags.example.com',
				description: 'desc',
				tags: 'tool',
				year: 2026,
				github: 'https://github.com/example/project'
			}
		])

		assert.deepEqual(projects, [
			{
				name: 'Valid Project',
				image: '/cover.png',
				url: 'https://example.com',
				description: 'desc',
				tags: ['tool', 'blog'],
				year: 0,
				npm: 'valid-package'
			},
			{
				name: 'No Tags',
				image: '/cover-2.png',
				url: 'https://no-tags.example.com',
				description: 'desc',
				tags: [],
				year: 2026,
				github: 'https://github.com/example/project'
			}
		])
	})
})
