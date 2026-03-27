import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildBlogUpsertItem, type PushBlogParams } from './push-blog'

describe('buildBlogUpsertItem', () => {
	it('将 folderPath 与 favorite 透传到 upsertItem', () => {
		const form: PushBlogParams['form'] = {
			slug: 'post-1',
			title: '标题',
			md: '# hello',
			tags: ['a'],
			date: '2026-03-27T10:00:00.000Z',
			category: '分类A',
			folderPath: '/写作/技术',
			favorite: true
		}

		const item = buildBlogUpsertItem(form, form.date!, '/cover.png')
		assert.equal(item.folderPath, '/写作/技术')
		assert.equal(item.favorite, true)
		assert.equal(item.category, '分类A')
	})
})
