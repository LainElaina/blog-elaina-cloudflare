import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { hasBlogSaveChanges } from './save-change-detection'
import type { BlogIndexItem } from './types'

describe('hasBlogSaveChanges', () => {
	const base: BlogIndexItem = {
		slug: 'post-1',
		title: '标题',
		tags: ['a'],
		date: '2026-03-27T10:00:00.000Z'
	}

	it('folderPath 变化应被识别为可保存改动', () => {
		const changed = hasBlogSaveChanges({
			items: [base],
			editableItems: [{ ...base, folderPath: '/写作/技术' }],
			categoryList: [],
			categoriesFromServer: []
		})
		assert.equal(changed, true)
	})

	it('favorite 变化应被识别为可保存改动', () => {
		const changed = hasBlogSaveChanges({
			items: [base],
			editableItems: [{ ...base, favorite: true }],
			categoryList: [],
			categoriesFromServer: []
		})
		assert.equal(changed, true)
	})

	it('无删除且分类与元数据均不变时返回 false', () => {
		const changed = hasBlogSaveChanges({
			items: [base],
			editableItems: [{ ...base }],
			categoryList: [],
			categoriesFromServer: []
		})
		assert.equal(changed, false)
	})
})
