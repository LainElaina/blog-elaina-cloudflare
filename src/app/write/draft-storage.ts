import type { ImageItem, PublishForm } from './types'

export const WRITE_CREATE_DRAFT_KEY = 'write:draft:create'
export const WRITE_EDIT_DRAFT_KEY_PREFIX = 'write:draft:edit:'

export type WriteDraftStorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export type PersistedWriteDraft = {
	mode: 'create' | 'edit'
	originalSlug?: string
	form: {
		slug?: string
		title: string
		md: string
		tags: string[]
		date: string
		summary: string
		hidden: boolean
		category: string
		folderPath: string
		favorite: boolean
	}
	coverUrl: string | null
	imageUrls: string[]
}

type BrowserWindowLike = { localStorage: WriteDraftStorageLike }

const FENCED_CODE_BLOCK_PATTERN = /```[\s\S]*?```/g
const INLINE_CODE_PATTERN = /`[^`\n]*`/g
const LOCAL_IMAGE_LINK_OR_IMAGE_PATTERN = /!?\[[^\]]*\]\(local-image:[^)]+\)/

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string')

const normalizeString = (value: unknown): string => (typeof value === 'string' ? value : '')

const getResolvedStorage = (storage?: WriteDraftStorageLike | null): WriteDraftStorageLike | null => {
	if (storage !== undefined) {
		return storage
	}

	return getWriteDraftStorage()
}

const isPersistedWriteDraft = (value: unknown): value is PersistedWriteDraft => {
	if (!isRecord(value)) {
		return false
	}

	if (value.mode !== 'create' && value.mode !== 'edit') {
		return false
	}

	if ('originalSlug' in value && value.originalSlug !== undefined && typeof value.originalSlug !== 'string') {
		return false
	}

	if (value.coverUrl !== null && typeof value.coverUrl !== 'string') {
		return false
	}

	if (!isStringArray(value.imageUrls)) {
		return false
	}

	if (!isRecord(value.form)) {
		return false
	}

	const { form } = value
	if ('slug' in form && form.slug !== undefined && typeof form.slug !== 'string') {
		return false
	}

	if (
		typeof form.title !== 'string' ||
		typeof form.md !== 'string' ||
		!isStringArray(form.tags) ||
		typeof form.date !== 'string' ||
		typeof form.summary !== 'string'
	) {
		return false
	}

	if (typeof form.hidden !== 'boolean' || typeof form.category !== 'string' || typeof form.folderPath !== 'string' || typeof form.favorite !== 'boolean') {
		return false
	}

	if (value.mode === 'create' && value.originalSlug !== undefined) {
		return false
	}

	if (value.mode === 'edit' && 'slug' in form) {
		return false
	}

	return true
}

export function getWriteCreateDraftKey(): string {
	return WRITE_CREATE_DRAFT_KEY
}

export function getWriteEditDraftKey(slug: string): string {
	return `${WRITE_EDIT_DRAFT_KEY_PREFIX}${slug}`
}

export function getWriteDraftStorage(windowLike?: BrowserWindowLike | null): WriteDraftStorageLike | null {
	const resolvedWindowLike = windowLike === undefined ? ((typeof window === 'undefined' ? null : window) as BrowserWindowLike | null) : windowLike
	if (!resolvedWindowLike) {
		return null
	}

	try {
		return resolvedWindowLike.localStorage
	} catch {
		return null
	}
}

export function serializeWriteDraft(params: {
	mode: 'create' | 'edit'
	originalSlug: string | null
	form: PublishForm
	cover: ImageItem | null
	images: ImageItem[]
}): PersistedWriteDraft {
	const { mode, originalSlug, form, cover, images } = params
	const persistedForm: PersistedWriteDraft['form'] = {
		title: form.title,
		md: form.md,
		tags: Array.isArray(form.tags) ? form.tags.filter((tag): tag is string => typeof tag === 'string') : [],
		date: form.date,
		summary: form.summary,
		hidden: Boolean(form.hidden),
		category: normalizeString(form.category),
		folderPath: normalizeString(form.folderPath),
		favorite: Boolean(form.favorite)
	}

	if (mode === 'create') {
		persistedForm.slug = form.slug
	}

	const draft: PersistedWriteDraft = {
		mode,
		form: persistedForm,
		coverUrl: cover?.type === 'url' ? cover.url : null,
		imageUrls: images.filter((image): image is Extract<ImageItem, { type: 'url' }> => image.type === 'url').map(image => image.url)
	}

	if (mode === 'edit' && originalSlug) {
		draft.originalSlug = originalSlug
	}

	return draft
}

export function readWriteDraft(key: string, storage?: WriteDraftStorageLike | null): PersistedWriteDraft | null {
	const resolvedStorage = getResolvedStorage(storage)
	if (!resolvedStorage) {
		return null
	}

	try {
		const rawDraft = resolvedStorage.getItem(key)
		if (!rawDraft) {
			return null
		}

		const parsedDraft: unknown = JSON.parse(rawDraft)
		return isPersistedWriteDraft(parsedDraft) ? parsedDraft : null
	} catch {
		return null
	}
}

export function writeWriteDraft(key: string, draft: PersistedWriteDraft, storage?: WriteDraftStorageLike | null): void {
	const resolvedStorage = getResolvedStorage(storage)
	if (!resolvedStorage) {
		return
	}

	try {
		resolvedStorage.setItem(key, JSON.stringify(draft))
	} catch {
		return
	}
}

export function clearWriteDraft(key: string, storage?: WriteDraftStorageLike | null): void {
	const resolvedStorage = getResolvedStorage(storage)
	if (!resolvedStorage) {
		return
	}

	try {
		resolvedStorage.removeItem(key)
	} catch {
		return
	}
}

export function hasWriteDraft(key: string, storage?: WriteDraftStorageLike | null): boolean {
	return readWriteDraft(key, storage) !== null
}

export function hasUnresolvedLocalImagePlaceholders(markdown: string): boolean {
	const sanitizedMarkdown = markdown.replace(FENCED_CODE_BLOCK_PATTERN, '').replace(INLINE_CODE_PATTERN, '')
	return LOCAL_IMAGE_LINK_OR_IMAGE_PATTERN.test(sanitizedMarkdown)
}
