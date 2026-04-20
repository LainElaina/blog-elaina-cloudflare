'use client'

import { createElement, useMemo, useState } from 'react'

type ShareMigrationOperation = 'preview' | 'execute'
type ShareMigrationResultTone = 'success' | 'error'

type ShareMigrationResponsePayload = {
	ok?: unknown
	operation?: unknown
	summary?: unknown
	message?: unknown
	notice?: unknown
	artifactsToRebuild?: unknown
	writtenArtifacts?: unknown
	artifactsToRebuildBeforeExecute?: unknown
	artifactsToRebuildAfterExecute?: unknown
	shouldRepreview?: unknown
}

export type ShareMigrationDirtyState = {
	isEditMode: boolean
	logoItemsCount: number
	renamedUrlsCount: number
	draftOnlyUrlsCount: number
	deletedPublishedUrlsCount: number
	editingAnchorUrlsCount: number
}

export type ShareMigrationPanelResult = {
	operation: ShareMigrationOperation
	tone: ShareMigrationResultTone
	message: string
	notice?: string
	artifactsToRebuild: string[]
	writtenArtifacts: string[]
	artifactsToRebuildBeforeExecute: string[]
	artifactsToRebuildAfterExecute: string[]
	shouldRepreview?: boolean
}

export const SHARE_MIGRATION_PANEL_MODEL = {
	title: 'share 正式产物工具',
	previewButtonLabel: '预检查',
	executeButtonLabel: '执行重建',
	executeConfirmText: '执行前需要明确确认；该操作只会重建 share 正式产物，不改 logo 文件。',
	description: '只处理 share 正式产物，不改 logo 文件；预检查基于当前磁盘快照。',
	dirtyPreviewNotice: '当前结果不包含未保存编辑',
	executeDisabledText: '请先保存或取消当前编辑，再执行 share 正式产物重建'
} as const

function asOptionalString(value: unknown) {
	return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}

function asStringArray(value: unknown) {
	if (!Array.isArray(value)) {
		return []
	}

	return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

export function buildShareMigrationPreviewFallbackSummary(artifactsToRebuild: string[]) {
	if (artifactsToRebuild.length === 0) {
		return '当前 share 正式产物与账本一致，无需重建。'
	}

	return `待重建 share 正式产物：${artifactsToRebuild.join('、')}`
}

function buildShareMigrationExecuteFallbackSummary(params: {
	writtenArtifacts: string[]
	artifactsToRebuildAfterExecute: string[]
}) {
	if (params.artifactsToRebuildAfterExecute.length === 0) {
		return '已重建 share 正式产物。'
	}

	if (params.writtenArtifacts.length > 0) {
		return '已写回 share 正式产物，建议重新预检查确认当前磁盘状态。'
	}

	return '执行重建失败'
}

export function resolveShareMigrationPanelMessage(payload: { summary?: unknown; message?: unknown }, fallback: string) {
	return asOptionalString(payload.summary) ?? asOptionalString(payload.message) ?? fallback
}

function hasShareMigrationDirtyState(dirtyState: ShareMigrationDirtyState) {
	return (
		dirtyState.isEditMode ||
		dirtyState.logoItemsCount > 0 ||
		dirtyState.renamedUrlsCount > 0 ||
		dirtyState.draftOnlyUrlsCount > 0 ||
		dirtyState.deletedPublishedUrlsCount > 0 ||
		dirtyState.editingAnchorUrlsCount > 0
	)
}

export function getShareMigrationPanelControls(params: {
	dirtyState: ShareMigrationDirtyState
	isPreviewPending: boolean
	isExecutePending: boolean
}) {
	const isDirty = hasShareMigrationDirtyState(params.dirtyState)

	return {
		previewDisabled: params.isPreviewPending || params.isExecutePending,
		executeDisabled: isDirty || params.isPreviewPending || params.isExecutePending,
		executeDisabledReason: isDirty ? SHARE_MIGRATION_PANEL_MODEL.executeDisabledText : undefined,
		showDirtyPreviewNotice: isDirty
	}
}

function normalizeShareMigrationResult(params: {
	operation: ShareMigrationOperation
	responseOk: boolean
	payload: ShareMigrationResponsePayload
}): ShareMigrationPanelResult {
	const artifactsToRebuild = asStringArray(params.payload.artifactsToRebuild)
	const writtenArtifacts = asStringArray(params.payload.writtenArtifacts)
	const artifactsToRebuildBeforeExecute = asStringArray(params.payload.artifactsToRebuildBeforeExecute)
	const artifactsToRebuildAfterExecute = asStringArray(params.payload.artifactsToRebuildAfterExecute)
	const fallbackMessage =
		params.operation === 'preview'
			? buildShareMigrationPreviewFallbackSummary(artifactsToRebuild)
			: buildShareMigrationExecuteFallbackSummary({
				writtenArtifacts,
				artifactsToRebuildAfterExecute
			})
	const message = params.responseOk
		? resolveShareMigrationPanelMessage(params.payload, fallbackMessage)
		: resolveShareMigrationPanelMessage(params.payload, params.operation === 'preview' ? '预检查失败' : '执行重建失败')

	return {
		operation: params.operation,
		tone: params.responseOk ? 'success' : 'error',
		message,
		notice: asOptionalString(params.payload.notice),
		artifactsToRebuild,
		writtenArtifacts,
		artifactsToRebuildBeforeExecute,
		artifactsToRebuildAfterExecute,
		shouldRepreview: params.payload.shouldRepreview === true
	}
}

async function readShareMigrationPayload(response: Response): Promise<ShareMigrationResponsePayload> {
	const data = await response.json().catch(() => ({}))
	return typeof data === 'object' && data ? (data as ShareMigrationResponsePayload) : {}
}

function ResultList(props: {
	label: string
	items: string[]
}) {
	if (props.items.length === 0) {
		return null
	}

	return createElement(
		'div',
		{ className: 'mt-3' },
		createElement('div', { className: 'text-[11px] font-medium text-gray-700' }, props.label),
		createElement(
			'div',
			{ className: 'mt-1 flex flex-wrap gap-1.5' },
			props.items.map(item =>
				createElement(
					'span',
					{
						key: `${props.label}:${item}`,
						className: 'rounded-full border border-white/80 bg-white/80 px-2 py-0.5 text-[11px] text-gray-700'
					},
					item
				)
			)
		)
	)
}

export function ShareMigrationPanelView(props: {
	dirtyState: ShareMigrationDirtyState
	lastResult: ShareMigrationPanelResult | null
	isPreviewPending: boolean
	isExecutePending: boolean
	onPreview: () => void | Promise<void>
	onExecute: () => void | Promise<void>
}) {
	const controls = getShareMigrationPanelControls({
		dirtyState: props.dirtyState,
		isPreviewPending: props.isPreviewPending,
		isExecutePending: props.isExecutePending
	})
	const resultLabel = props.lastResult?.operation === 'execute' ? '最近执行结果' : '最近预检查结果'
	const resultToneClass = props.lastResult?.tone === 'error' ? 'border-red-200 bg-red-50/80 text-red-700' : 'border-amber-200 bg-white/80 text-gray-800'

	return createElement(
		'div',
		{
			className: 'w-80 max-w-[calc(100vw-3rem)] rounded-2xl border border-dashed border-amber-300 bg-amber-50/80 p-4 text-left shadow-sm backdrop-blur-sm'
		},
		createElement('div', { className: 'text-sm font-medium text-gray-900' }, SHARE_MIGRATION_PANEL_MODEL.title),
		createElement('div', { className: 'mt-1 text-xs leading-5 text-gray-600' }, SHARE_MIGRATION_PANEL_MODEL.description),
		controls.showDirtyPreviewNotice
			? createElement('div', { className: 'mt-2 text-xs text-amber-800' }, SHARE_MIGRATION_PANEL_MODEL.dirtyPreviewNotice)
			: null,
		controls.executeDisabledReason
			? createElement('div', { className: 'mt-1 text-xs text-amber-800' }, controls.executeDisabledReason)
			: null,
		createElement(
			'div',
			{ className: 'mt-3 flex flex-wrap gap-2' },
			createElement(
				'button',
				{
					type: 'button',
					onClick: () => {
						void props.onPreview()
					},
					disabled: controls.previewDisabled,
					className: 'rounded-lg border border-white/80 bg-white px-3 py-2 text-sm text-gray-800 disabled:cursor-not-allowed disabled:opacity-60'
				},
				props.isPreviewPending ? '预检查中...' : SHARE_MIGRATION_PANEL_MODEL.previewButtonLabel
			),
			createElement(
				'button',
				{
					type: 'button',
					onClick: () => {
						void props.onExecute()
					},
					disabled: controls.executeDisabled,
					className: 'rounded-lg border border-amber-300 bg-amber-100 px-3 py-2 text-sm text-amber-900 disabled:cursor-not-allowed disabled:opacity-60'
				},
				props.isExecutePending ? '重建中...' : SHARE_MIGRATION_PANEL_MODEL.executeButtonLabel
			)
		),
		props.lastResult
			? createElement(
					'div',
					{ className: `mt-3 rounded-xl border px-3 py-3 text-xs ${resultToneClass}` },
					createElement('div', { className: 'font-medium' }, resultLabel),
					createElement('div', { className: 'mt-1 leading-5' }, props.lastResult.message),
					props.lastResult.notice
						? createElement('div', { className: 'mt-2 leading-5 text-gray-600' }, props.lastResult.notice)
						: null,
					props.lastResult.shouldRepreview
						? createElement('div', { className: 'mt-2 leading-5 text-amber-800' }, '建议重新执行预检查后，再决定是否继续操作。')
						: null,
					createElement(ResultList, { label: '待重建产物', items: props.lastResult.artifactsToRebuild }),
					createElement(ResultList, { label: '已写回产物', items: props.lastResult.writtenArtifacts }),
					createElement(ResultList, { label: '执行前待重建', items: props.lastResult.artifactsToRebuildBeforeExecute }),
					createElement(ResultList, { label: '执行后待重建', items: props.lastResult.artifactsToRebuildAfterExecute })
				)
			: null
	)
}

export function ShareMigrationPanel(props: {
	dirtyState: ShareMigrationDirtyState
}) {
	const [lastResult, setLastResult] = useState<ShareMigrationPanelResult | null>(null)
	const [isPreviewPending, setIsPreviewPending] = useState(false)
	const [isExecutePending, setIsExecutePending] = useState(false)
	const controls = useMemo(
		() =>
			getShareMigrationPanelControls({
				dirtyState: props.dirtyState,
				isPreviewPending,
				isExecutePending
			}),
		[props.dirtyState, isPreviewPending, isExecutePending]
	)

	const handlePreview = async () => {
		if (controls.previewDisabled) {
			return
		}

		setIsPreviewPending(true)
		try {
			const response = await fetch('/api/share-migration/preview', {
				cache: 'no-store'
			})
			const payload = await readShareMigrationPayload(response)
			setLastResult(
				normalizeShareMigrationResult({
					operation: 'preview',
					responseOk: response.ok,
					payload
				})
			)
		} catch (error) {
			setLastResult({
				operation: 'preview',
				tone: 'error',
				message: error instanceof Error ? error.message : '预检查失败',
				artifactsToRebuild: [],
				writtenArtifacts: [],
				artifactsToRebuildBeforeExecute: [],
				artifactsToRebuildAfterExecute: []
			})
		} finally {
			setIsPreviewPending(false)
		}
	}

	const handleExecute = async () => {
		if (controls.executeDisabled) {
			return
		}

		const confirmed = window.confirm(SHARE_MIGRATION_PANEL_MODEL.executeConfirmText)
		if (!confirmed) {
			return
		}

		setIsExecutePending(true)
		try {
			const response = await fetch('/api/share-migration/execute', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ confirmed: true })
			})
			const payload = await readShareMigrationPayload(response)
			setLastResult(
				normalizeShareMigrationResult({
					operation: 'execute',
					responseOk: response.ok,
					payload
				})
			)
		} catch (error) {
			setLastResult({
				operation: 'execute',
				tone: 'error',
				message: error instanceof Error ? error.message : '执行重建失败',
				artifactsToRebuild: [],
				writtenArtifacts: [],
				artifactsToRebuildBeforeExecute: [],
				artifactsToRebuildAfterExecute: []
			})
		} finally {
			setIsExecutePending(false)
		}
	}

	return createElement(ShareMigrationPanelView, {
		dirtyState: props.dirtyState,
		lastResult,
		isPreviewPending,
		isExecutePending,
		onPreview: handlePreview,
		onExecute: handleExecute
	})
}
