import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import {
	SHARE_MIGRATION_PANEL_MODEL,
	ShareMigrationPanelView,
	buildShareMigrationPreviewFallbackSummary,
	getShareMigrationPanelControls,
	normalizeShareMigrationResult,
	resolveShareMigrationPanelMessage
} from './share-migration-panel.tsx'

const CLEAN_DIRTY_STATE = {
	isEditMode: false,
	logoItemsCount: 0,
	renamedUrlsCount: 0,
	draftOnlyUrlsCount: 0,
	deletedPublishedUrlsCount: 0,
	editingAnchorUrlsCount: 0
}

function createResult(overrides = {}) {
	return {
		operation: 'preview',
		tone: 'success',
		message: '待重建 share 正式产物：public/share/list.json',
		notice: undefined,
		artifactsToRebuild: [],
		writtenArtifacts: [],
		writtenArtifactsPartial: [],
		artifactsToRebuildBeforeExecute: [],
		artifactsToRebuildAfterExecute: [],
		shouldRepreview: false,
		...overrides
	}
}

function renderPanel(params = {}) {
	const dirtyState = params.dirtyState ?? CLEAN_DIRTY_STATE
	const lastResult = params.lastResult ?? null

	return renderToStaticMarkup(
		createElement(ShareMigrationPanelView, {
			dirtyState,
			lastResult,
			isPreviewPending: false,
			isExecutePending: false,
			onPreview: () => undefined,
			onExecute: () => undefined
		})
	)
}

describe('share migration panel', () => {
	it('显示标题与 preview/execute 按钮文案', () => {
		const markup = renderPanel()

		assert.match(markup, /share 正式产物工具/)
		assert.match(markup, />预检查<\/button>/)
		assert.match(markup, />执行重建<\/button>/)
	})

	it('execute 动作包含明确确认提示', () => {
		assert.match(SHARE_MIGRATION_PANEL_MODEL.executeConfirmText, /需要明确确认/)
		assert.match(SHARE_MIGRATION_PANEL_MODEL.executeConfirmText, /不改 logo 文件/)
	})

	it('优先展示服务端返回的真实 summary', () => {
		assert.equal(
			resolveShareMigrationPanelMessage(
				{
					summary: '已按当前账本重建 4 份正式产物。',
					message: '这个 message 不应覆盖 summary。'
				},
				buildShareMigrationPreviewFallbackSummary(['public/share/list.json'])
			),
			'已按当前账本重建 4 份正式产物。'
		)
	})

	it('明确说明不改 logo 文件，且 preview 基于当前磁盘快照', () => {
		const markup = renderPanel()

		assert.match(markup, /不改 logo 文件/)
		assert.match(markup, /基于当前磁盘快照/)
	})

	it('executeDisabled 只由六个 dirty signals 推导，不受 pending 状态影响', () => {
		const pendingCases = [
			{ isPreviewPending: false, isExecutePending: false },
			{ isPreviewPending: true, isExecutePending: false },
			{ isPreviewPending: false, isExecutePending: true }
		]

		for (const pendingState of pendingCases) {
			const controls = getShareMigrationPanelControls({
				dirtyState: CLEAN_DIRTY_STATE,
				...pendingState
			})

			assert.equal(controls.executeDisabled, false)
			assert.equal(controls.executePendingDisabled, pendingState.isPreviewPending || pendingState.isExecutePending)
		}
	})

	it('任一 v1 dirty signal 存在时 preview 仍可用且 execute 保持 dirty disabled', () => {
		const dirtyCases = [
			{ ...CLEAN_DIRTY_STATE, isEditMode: true },
			{ ...CLEAN_DIRTY_STATE, logoItemsCount: 1 },
			{ ...CLEAN_DIRTY_STATE, renamedUrlsCount: 1 },
			{ ...CLEAN_DIRTY_STATE, draftOnlyUrlsCount: 1 },
			{ ...CLEAN_DIRTY_STATE, deletedPublishedUrlsCount: 1 },
			{ ...CLEAN_DIRTY_STATE, editingAnchorUrlsCount: 1 }
		]

		for (const dirtyState of dirtyCases) {
			const controls = getShareMigrationPanelControls({
				dirtyState,
				isPreviewPending: false,
				isExecutePending: false
			})

			assert.equal(controls.previewDisabled, false)
			assert.equal(controls.executeDisabled, true)
			assert.equal(controls.executePendingDisabled, false)
			assert.equal(controls.showDirtyPreviewNotice, true)
			assert.equal(controls.executeDisabledReason, SHARE_MIGRATION_PANEL_MODEL.executeDisabledText)
		}
	})

	it('preview 在编辑或 dirty 状态下提示当前结果不包含未保存编辑', () => {
		const controls = getShareMigrationPanelControls({
			dirtyState: {
				...CLEAN_DIRTY_STATE,
				isEditMode: true
			},
			isPreviewPending: false,
			isExecutePending: false
		})
		const markup = renderPanel({
			dirtyState: {
				...CLEAN_DIRTY_STATE,
				isEditMode: true
			},
			lastResult: createResult({
				artifactsToRebuild: ['public/share/list.json']
			})
		})

		assert.equal(controls.previewDisabled, false)
		assert.equal(controls.executeDisabled, true)
		assert.match(markup, /当前结果不包含未保存编辑/)
		assert.match(markup, /请先保存或取消当前编辑，再执行 share 正式产物重建/)
	})

	it('失败响应包含 partial write 时会展示已部分写回产物', () => {
		const result = normalizeShareMigrationResult({
			operation: 'execute',
			responseOk: false,
			payload: {
				message: '写回 share 正式产物时发生错误',
				writtenArtifactsPartial: ['public/share/list.json', 'public/share/categories.json'],
				shouldRepreview: true
			}
		})
		const markup = renderPanel({
			dirtyState: CLEAN_DIRTY_STATE,
			lastResult: result
		})

		assert.deepEqual(result.writtenArtifactsPartial, ['public/share/list.json', 'public/share/categories.json'])
		assert.match(markup, /已部分写回产物/)
		assert.match(markup, /public\/share\/list\.json/)
		assert.match(markup, /public\/share\/categories\.json/)
		assert.match(markup, /建议重新执行预检查后，再决定是否继续操作。/)
	})
})
