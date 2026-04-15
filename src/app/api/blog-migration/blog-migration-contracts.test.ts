import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	buildExecuteSuccessResponse,
	buildPreviewResponse,
	validateExecuteRequest
} from './blog-migration-contracts.ts'

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
		assert.equal(result.summary, '待重建产物：public/blogs/index.json、public/blogs/storage.json')
	})

	it('preview 在无需重建时返回已一致说明', () => {
		const result = buildPreviewResponse({ artifactsToRebuild: [] })
		assert.equal(result.summary, '当前正式产物已与账本一致，无需重建。')
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

	it('execute 成功时返回真实执行摘要而非空成功', () => {
		const result = buildExecuteSuccessResponse({
			writtenArtifacts: ['public/blogs/index.json', 'public/blogs/storage.json'],
			artifactsToRebuildBeforeExecute: ['public/blogs/storage.json'],
			artifactsToRebuildAfterExecute: []
		})

		assert.equal(result.ok, true)
		assert.deepEqual(result.writtenArtifacts, ['public/blogs/index.json', 'public/blogs/storage.json'])
		assert.deepEqual(result.artifactsToRebuildBeforeExecute, ['public/blogs/storage.json'])
		assert.deepEqual(result.artifactsToRebuildAfterExecute, [])
		assert.match(result.summary, /已同步账本并重建 2 个产物/)
		assert.match(result.summary, /执行后无需再重建/)
	})
})
