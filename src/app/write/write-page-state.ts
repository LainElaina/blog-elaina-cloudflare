import type { ImageItem } from './types'
import { getWriteCreateDraftKey, getWriteEditDraftKey } from './draft-storage'
import { getUnresolvedLocalImagePlaceholderIds } from './write-safety'

type WritePageMode = 'create' | 'edit'

type WritePageKeyParams = {
	mode: WritePageMode
	routeSlug?: string
	loadedOriginalSlug?: string | null
	hasLoadedBlog?: boolean
}

type WritePageAutosaveKeyParams = WritePageKeyParams & {
	hasHydratedDraft: boolean
	isClearingDraft?: boolean
}

type BeforeUnloadParams = {
	hasHydratedDraft: boolean
	isDirty: boolean
}

type RestoredPlaceholderWarningParams = {
	hasRestoredDraft: boolean
	markdown: string
	images: ImageItem[]
}

export type RestoredPlaceholderWarningState = {
	shouldShowWarning: boolean
	unresolvedPlaceholderIds: string[]
}

export function getWritePageDraftKey(params: WritePageKeyParams): string | null {
	if (params.mode === 'create') {
		return getWriteCreateDraftKey()
	}

	if (!params.hasLoadedBlog || !params.routeSlug || !params.loadedOriginalSlug) {
		return null
	}

	if (params.routeSlug !== params.loadedOriginalSlug) {
		return null
	}

	return getWriteEditDraftKey(params.routeSlug)
}

export function getWritePageAutosaveKey(params: WritePageAutosaveKeyParams): string | null {
	if (!params.hasHydratedDraft || params.isClearingDraft) {
		return null
	}

	return getWritePageDraftKey(params)
}

export function shouldProtectWritePageBeforeUnload(params: BeforeUnloadParams): boolean {
	return params.hasHydratedDraft && params.isDirty
}

export function getRestoredPlaceholderWarningState(params: RestoredPlaceholderWarningParams): RestoredPlaceholderWarningState {
	if (!params.hasRestoredDraft) {
		return {
			shouldShowWarning: false,
			unresolvedPlaceholderIds: []
		}
	}

	const unresolvedPlaceholderIds = getUnresolvedLocalImagePlaceholderIds(params.markdown, params.images)

	return {
		shouldShowWarning: unresolvedPlaceholderIds.length > 0,
		unresolvedPlaceholderIds
	}
}
