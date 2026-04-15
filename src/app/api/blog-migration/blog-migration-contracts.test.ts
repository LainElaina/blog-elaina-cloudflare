import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildPreviewResponse, validateExecuteRequest } from './blog-migration-contracts.ts'

describe('blog migration api contracts', () => {
	it('preview 返回待重建产物与不会修改 markdown/image 的说明', () => {
		const result = buildPreviewResponse({
			artifactsToRebuild: [
				'public/blogs/index.json',
				'public/blogs/storage.json'
			]
		})

		assert.deepEqual(result.artifactsToRebuild, [
			'public/blogs/index.json',
			'public/blogs/storage.json'
		])
		assert.match(result.notice, /不会修改 Markdown 或图片/)
	})

	it('execute 在没有明确确认时拒绝执行', () => {
		assert.deepEqual(validateExecuteRequest({ confirmed: false }), {
			allowed: false,
			message: '执行前需要明确确认'
		})
	})

	it('execute 在明确确认时允许执行', () => {
		assert.deepEqual(validateExecuteRequest({ confirmed: true }), {
			allowed: true,
			message: null
		})
	})
})
