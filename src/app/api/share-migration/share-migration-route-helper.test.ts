import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildShareMigrationExecuteRouteResponse, buildShareMigrationPreviewRouteResponse, enforceDevelopmentOnly } from './share-migration-route-helper.ts'

describe('share migration route helper', () => {
	it('rejects non-development preview access with a structured response', () => {
		const response = enforceDevelopmentOnly({
			nodeEnv: 'production',
			operation: 'preview'
		})

		assert.deepEqual(response, {
			allowed: false,
			status: 403,
			body: {
				ok: false,
				operation: 'preview',
				code: 'DEV_ONLY',
				message: '仅开发环境可用'
			}
		})
	})

	it('allows development access', () => {
		assert.deepEqual(
			enforceDevelopmentOnly({
				nodeEnv: 'development',
				operation: 'execute'
			}),
			{
				allowed: true
			}
		)
	})

	it('wraps preview success body in a status and body pair', () => {
		const response = buildShareMigrationPreviewRouteResponse({
			summary: '待重建 share 正式产物：public/share/storage.json',
			notice: '只处理 share 正式产物，不会修改 logo 图片。',
			artifactsToRebuild: ['public/share/storage.json']
		})

		assert.equal(response.status, 200)
		assert.deepEqual(response.body, {
			ok: true,
			operation: 'preview',
			summary: '待重建 share 正式产物：public/share/storage.json',
			notice: '只处理 share 正式产物，不会修改 logo 图片。',
			artifactsToRebuild: ['public/share/storage.json']
		})
	})

	it('rejects execute when confirmed is false', () => {
		const response = buildShareMigrationExecuteRouteResponse({
			confirmed: false,
			summary: '不会执行',
			writtenArtifacts: [],
			artifactsToRebuildBeforeExecute: [],
			artifactsToRebuildAfterExecute: []
		})

		assert.deepEqual(response, {
			status: 400,
			body: {
				ok: false,
				operation: 'execute',
				code: 'UNCONFIRMED',
				message: '执行前需要明确确认'
			}
		})
	})

	it('requires confirmed to be strictly true', () => {
		for (const confirmed of ['true', 1, null, undefined]) {
			const response = buildShareMigrationExecuteRouteResponse({
				confirmed,
				summary: '不会执行',
				writtenArtifacts: [],
				artifactsToRebuildBeforeExecute: [],
				artifactsToRebuildAfterExecute: []
			})

			assert.equal(response.status, 400)
			assert.deepEqual(response.body, {
				ok: false,
				operation: 'execute',
				code: 'UNCONFIRMED',
				message: '执行前需要明确确认'
			})
		}
	})

	it('returns execute success only when confirmed is strictly true', () => {
		const response = buildShareMigrationExecuteRouteResponse({
			confirmed: true,
			summary: '已重建 share 正式产物。',
			notice: '只处理 share 正式产物，不会修改 logo 图片。',
			writtenArtifacts: ['public/share/list.json', 'public/share/storage.json'],
			artifactsToRebuildBeforeExecute: ['public/share/storage.json'],
			artifactsToRebuildAfterExecute: []
		})

		assert.deepEqual(response, {
			status: 200,
			body: {
				ok: true,
				operation: 'execute',
				summary: '已重建 share 正式产物。',
				notice: '只处理 share 正式产物，不会修改 logo 图片。',
				writtenArtifacts: ['public/share/list.json', 'public/share/storage.json'],
				artifactsToRebuildBeforeExecute: ['public/share/storage.json'],
				artifactsToRebuildAfterExecute: []
			}
		})
	})
})
