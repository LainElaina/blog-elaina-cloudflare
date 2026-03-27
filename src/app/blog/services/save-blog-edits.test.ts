import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildLocalSaveFilePayloadsFromContents, mergeCategoriesForSave } from './save-blog-edits-utils.ts'

describe('mergeCategoriesForSave', () => {
	it('优先保留显式传入分类顺序，并保留未分配分类', () => {
		const merged = mergeCategoriesForSave(['前端', '后端', '归档'], ['后端', '前端'])
		assert.deepEqual(merged, ['前端', '后端', '归档'])
	})

	it('当显式分类缺失时，追加文章中派生出的分类', () => {
		const merged = mergeCategoriesForSave(['前端'], ['后端', '前端', '数据'])
		assert.deepEqual(merged, ['前端', '后端', '数据'])
	})
})

describe('buildLocalSaveFilePayloadsFromContents', () => {
	it('本地开发保存应同时生成 index/categories/folders/storage 四个文件', () => {
		const payloads = buildLocalSaveFilePayloadsFromContents({
			index: '[]',
			categories: '{"categories":[]}',
			folders: '[]',
			storage: '{"version":1}'
		})

		assert.deepEqual(
			payloads.map(item => item.path).sort(),
			[
				'public/blogs/categories.json',
				'public/blogs/folders.json',
				'public/blogs/index.json',
				'public/blogs/storage.json'
			]
		)
	})
})
