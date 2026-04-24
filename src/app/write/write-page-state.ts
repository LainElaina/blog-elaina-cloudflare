import type { ImageItem } from './types'
import { getWriteCreateDraftKey, getWriteEditDraftKey } from './draft-storage'

type WritePageMode = 'create' | 'edit'

type WritePageKeyParams = {
	mode: WritePageMode
	routeSlug?: string
	loadedOriginalSlug?: string | null
	hasLoadedBlog?: boolean
}

type WritePageAutosaveKeyParams = WritePageKeyParams & {
	hasHydratedDraft: boolean
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

const FENCED_CODE_BLOCK_PATTERN = /```[\s\S]*?```/g
const INLINE_CODE_PATTERN = /`[^`\n]*`/g
const LOCAL_IMAGE_LINK_OR_IMAGE_PATTERN = /!?\[[^\]]*\]\(local-image:([^)]+)\)/g

const getLocalImagePlaceholderIds = (markdown: string): string[] => {
	const sanitizedMarkdown = markdown.replace(FENCED_CODE_BLOCK_PATTERN, '').replace(INLINE_CODE_PATTERN, '')
	const placeholderIds = new Set<string>()

	for (const match of sanitizedMarkdown.matchAll(LOCAL_IMAGE_LINK_OR_IMAGE_PATTERN)) {
		const placeholderId = match[1]?.trim()
		if (placeholderId) {
			placeholderIds.add(placeholderId)
		}
	}

	return [...placeholderIds]
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
	if (!params.hasHydratedDraft) {
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

	const placeholderIds = getLocalImagePlaceholderIds(params.markdown)
	if (placeholderIds.length === 0) {
		return {
			shouldShowWarning: false,
			unresolvedPlaceholderIds: []
		}
	}

	const liveFileIds = new Set(params.images.filter((image): image is Extract<ImageItem, { type: 'file' }> => image.type === 'file').map(image => image.id))
	const unresolvedPlaceholderIds = placeholderIds.filter(placeholderId => !liveFileIds.has(placeholderId))

	return {
		shouldShowWarning: unresolvedPlaceholderIds.length > 0,
		unresolvedPlaceholderIds
	}
}
