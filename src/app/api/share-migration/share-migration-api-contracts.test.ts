import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	buildShareMigrationExecuteSuccessResponse,
	buildShareMigrationFailureResponse,
	buildShareMigrationPreviewResponse
} from './share-migration-api-contracts.ts'

describe('share migration api contracts', () => {
	it('preview success body includes ok operation summary and artifacts to rebuild', () => {
		const response = buildShareMigrationPreviewResponse({
			summary: '待重建 share 正式产物：public/share/list.json',
			notice: '只处理 share 正式产物，不会修改 logo 图片。',
			artifactsToRebuild: ['public/share/list.json']
		})

		assert.deepEqual(response, {
			ok: true,
			operation: 'preview',
			summary: '待重建 share 正式产物：public/share/list.json',
			notice: '只处理 share 正式产物，不会修改 logo 图片。',
			artifactsToRebuild: ['public/share/list.json']
		})
	})

	it('execute success body includes write results and before after drift lists', () => {
		const response = buildShareMigrationExecuteSuccessResponse({
			summary: '已重建 share 正式产物。',
			notice: '只处理 share 正式产物，不会修改 logo 图片。',
			writtenArtifacts: ['public/share/list.json', 'public/share/storage.json'],
			artifactsToRebuildBeforeExecute: ['public/share/storage.json'],
			artifactsToRebuildAfterExecute: []
		})

		assert.deepEqual(response, {
			ok: true,
			operation: 'execute',
			summary: '已重建 share 正式产物。',
			notice: '只处理 share 正式产物，不会修改 logo 图片。',
			writtenArtifacts: ['public/share/list.json', 'public/share/storage.json'],
			artifactsToRebuildBeforeExecute: ['public/share/storage.json'],
			artifactsToRebuildAfterExecute: []
		})
	})

	it('failure body uses the unified shape', () => {
		const response = buildShareMigrationFailureResponse({
			operation: 'preview',
			code: 'ARTIFACT_INVALID_JSON',
			message: 'public/share/list.json 不是合法 JSON',
			details: { artifact: 'public/share/list.json' }
		})

		assert.deepEqual(response, {
			ok: false,
			operation: 'preview',
			code: 'ARTIFACT_INVALID_JSON',
			message: 'public/share/list.json 不是合法 JSON',
			details: { artifact: 'public/share/list.json' }
		})
	})

	it('WRITE_FAILED also includes partial write details and re-preview hint', () => {
		const response = buildShareMigrationFailureResponse({
			operation: 'execute',
			code: 'WRITE_FAILED',
			message: '写入 public/share/folders.json 失败',
			writtenArtifactsPartial: ['public/share/list.json', 'public/share/categories.json'],
			shouldRepreview: true
		})

		assert.deepEqual(response, {
			ok: false,
			operation: 'execute',
			code: 'WRITE_FAILED',
			message: '写入 public/share/folders.json 失败',
			writtenArtifactsPartial: ['public/share/list.json', 'public/share/categories.json'],
			shouldRepreview: true
		})
	})
})
