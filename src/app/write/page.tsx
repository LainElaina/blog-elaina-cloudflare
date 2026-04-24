'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { WriteEditor } from './components/editor'
import { WriteSidebar } from './components/sidebar'
import { WriteActions } from './components/actions'
import { WritePreview } from './components/preview'
import { usePreviewStore } from './stores/preview-store'
import { useWriteStore } from './stores/write-store'
import { readWriteDraft, serializeWriteDraft, writeWriteDraft } from './draft-storage'
import { getRestoredPlaceholderWarningState, getWritePageAutosaveKey, getWritePageDraftKey, shouldProtectWritePageBeforeUnload } from './write-page-state'
import { createEmptyWriteBaseline, isWriteStateDirty, resolveWriteDraftRestore, type WriteSafetySnapshot } from './write-safety'
import type { ImageItem, PublishForm } from './types'

const AUTOSAVE_DELAY_MS = 500

const buildWriteSnapshot = (params: {
	mode: 'create' | 'edit'
	originalSlug: string | null
	form: PublishForm
	cover: ImageItem | null
	images: ImageItem[]
}): WriteSafetySnapshot => ({
	mode: params.mode,
	originalSlug: params.originalSlug,
	form: {
		...params.form,
		tags: [...params.form.tags]
	},
	cover: params.cover ? { ...params.cover } : null,
	images: params.images.map(image => ({ ...image }))
})

export default function WritePage() {
	const { form, cover, images, replaceWithSnapshot } = useWriteStore()
	const { isPreview, closePreview } = usePreviewStore()
	const [baseline, setBaseline] = useState<WriteSafetySnapshot | null>(null)
	const [hasHydratedDraft, setHasHydratedDraft] = useState(false)
	const [hasRestoredDraft, setHasRestoredDraft] = useState(false)
	const hasInitializedAutosaveRef = useRef(false)

	const currentSnapshot = useMemo(
		() =>
			buildWriteSnapshot({
				mode: 'create',
				originalSlug: null,
				form,
				cover,
				images
			}),
		[cover, form, images]
	)

	const isDirty = useMemo(() => (baseline ? isWriteStateDirty({ baseline, current: currentSnapshot }) : false), [baseline, currentSnapshot])
	const draftKey = getWritePageDraftKey({ mode: 'create' })
	const autosaveKey = getWritePageAutosaveKey({ mode: 'create', hasHydratedDraft })
	const shouldProtectBeforeUnload = shouldProtectWritePageBeforeUnload({ hasHydratedDraft, isDirty })
	const restoredPlaceholderWarning = getRestoredPlaceholderWarningState({
		hasRestoredDraft,
		markdown: form.md,
		images
	})

	useEffect(() => {
		const emptyBaseline = createEmptyWriteBaseline()
		setBaseline(emptyBaseline)

		const restored = resolveWriteDraftRestore({
			draft: readWriteDraft(draftKey),
			mode: 'create'
		})

		if (restored.shouldRestore) {
			replaceWithSnapshot(restored.restored)
			setHasRestoredDraft(true)
		} else {
			replaceWithSnapshot(emptyBaseline)
			setHasRestoredDraft(false)
		}

		hasInitializedAutosaveRef.current = false
		setHasHydratedDraft(true)
	}, [draftKey, replaceWithSnapshot])

	useEffect(() => {
		if (!autosaveKey) {
			return
		}

		if (!hasInitializedAutosaveRef.current) {
			hasInitializedAutosaveRef.current = true
			return
		}

		const timer = window.setTimeout(() => {
			writeWriteDraft(
				autosaveKey,
				serializeWriteDraft({
					mode: currentSnapshot.mode,
					originalSlug: currentSnapshot.originalSlug,
					form: currentSnapshot.form,
					cover: currentSnapshot.cover,
					images: currentSnapshot.images
				})
			)
		}, AUTOSAVE_DELAY_MS)

		return () => {
			window.clearTimeout(timer)
		}
	}, [autosaveKey, currentSnapshot])

	useEffect(() => {
		if (!shouldProtectBeforeUnload) {
			return
		}

		const handleBeforeUnload = (event: BeforeUnloadEvent) => {
			event.preventDefault()
			event.returnValue = ''
		}

		window.addEventListener('beforeunload', handleBeforeUnload)
		return () => {
			window.removeEventListener('beforeunload', handleBeforeUnload)
		}
	}, [shouldProtectBeforeUnload])

	if (!hasHydratedDraft) {
		return <div className='text-secondary flex h-screen items-center justify-center text-sm'>正在恢复草稿...</div>
	}

	const coverPreviewUrl = cover ? (cover.type === 'url' ? cover.url : cover.previewUrl) : null

	return isPreview ? (
		<WritePreview form={form} coverPreviewUrl={coverPreviewUrl} onClose={closePreview} />
	) : (
		<>
			{restoredPlaceholderWarning.shouldShowWarning && (
				<div className='mx-auto mt-24 mb-4 w-full max-w-[1120px] rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm'>
					检测到上次恢复的草稿中仍有 {restoredPlaceholderWarning.unresolvedPlaceholderIds.length} 处本地图片引用失效，请重新选择图片并重新插入这些位置后再发布。
				</div>
			)}
			<div className='flex h-full justify-center gap-6 px-6 pt-24 pb-12'>
				<WriteEditor />
				<WriteSidebar />
			</div>

			<WriteActions />
		</>
	)
}
