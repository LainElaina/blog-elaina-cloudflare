import type { PublishForm, ImageItem } from './types'
import type { PersistedWriteDraft } from './draft-storage'
import { hasUnresolvedLocalImagePlaceholders } from './draft-storage'

export type WriteMode = 'create' | 'edit'

export type WriteSafetySnapshot = {
	mode: WriteMode
	originalSlug: string | null
	form: PublishForm
	cover: ImageItem | null
	images: ImageItem[]
}

export type WriteBaseline = WriteSafetySnapshot

type ComparableForm = PublishForm & {
	folderPath?: string
	favorite?: boolean
}

type RestoreFailureReason = 'missing-draft' | 'mode-mismatch' | 'slug-mismatch'

const pad = (value: number) => String(value).padStart(2, '0')

const formatDateTimeLocal = (date: Date = new Date()): string => {
	const year = date.getFullYear()
	const month = pad(date.getMonth() + 1)
	const day = pad(date.getDate())
	const hours = pad(date.getHours())
	const minutes = pad(date.getMinutes())
	return `${year}-${month}-${day}T${hours}:${minutes}`
}

const cloneForm = <TForm extends PublishForm>(form: TForm): TForm => ({
	...form,
	tags: [...(form.tags || [])]
})

const cloneImage = (image: ImageItem): ImageItem => ({ ...image })

const cloneImages = (images: ImageItem[]): ImageItem[] => images.map(cloneImage)

const cloneSnapshot = <TSnapshot extends WriteSafetySnapshot>(snapshot: TSnapshot): TSnapshot => ({
	...snapshot,
	form: cloneForm(snapshot.form),
	cover: snapshot.cover ? cloneImage(snapshot.cover) : null,
	images: cloneImages(snapshot.images)
})

const normalizeString = (value: unknown): string => (typeof value === 'string' ? value : '')
const normalizeBoolean = (value: unknown): boolean => value === true

const getComparableForm = (form: PublishForm): ComparableForm => form as ComparableForm

const getFormSignature = (form: PublishForm, mode: WriteMode) => {
	const comparable = getComparableForm(form)
	return {
		slug: mode === 'create' ? normalizeString(comparable.slug) : '',
		title: normalizeString(comparable.title),
		md: normalizeString(comparable.md),
		tags: [...(comparable.tags || [])],
		date: normalizeString(comparable.date),
		summary: normalizeString(comparable.summary),
		hidden: normalizeBoolean(comparable.hidden),
		category: normalizeString(comparable.category),
		folderPath: normalizeString(comparable.folderPath),
		favorite: normalizeBoolean(comparable.favorite)
	}
}

const areStringArraysEqual = (left: string[], right: string[]) => left.length === right.length && left.every((value, index) => value === right[index])

const areFormsEqual = (left: PublishForm, right: PublishForm, mode: WriteMode) => {
	const leftSignature = getFormSignature(left, mode)
	const rightSignature = getFormSignature(right, mode)

	return (
		leftSignature.slug === rightSignature.slug &&
		leftSignature.title === rightSignature.title &&
		leftSignature.md === rightSignature.md &&
		areStringArraysEqual(leftSignature.tags, rightSignature.tags) &&
		leftSignature.date === rightSignature.date &&
		leftSignature.summary === rightSignature.summary &&
		leftSignature.hidden === rightSignature.hidden &&
		leftSignature.category === rightSignature.category &&
		leftSignature.folderPath === rightSignature.folderPath &&
		leftSignature.favorite === rightSignature.favorite
	)
}

const getFileSignature = (file: File | undefined) => ({
	name: file?.name ?? '',
	size: file?.size ?? -1,
	type: file?.type ?? '',
	lastModified: file?.lastModified ?? -1
})

const getImageSignature = (image: ImageItem | null) => {
	if (!image) {
		return null
	}

	if (image.type === 'url') {
		return {
			type: 'url' as const,
			url: image.url
		}
	}

	return {
		type: 'file' as const,
		hash: image.hash ?? '',
		filename: image.filename,
		previewUrl: image.previewUrl,
		file: getFileSignature(image.file)
	}
}

const areImagesEqual = (left: ImageItem[], right: ImageItem[]) => {
	if (left.length !== right.length) {
		return false
	}

	return left.every((image, index) => {
		const rightImage = right[index]
		const leftSignature = getImageSignature(image)
		const rightSignature = getImageSignature(rightImage)
		return JSON.stringify(leftSignature) === JSON.stringify(rightSignature)
	})
}

export function createEmptyWriteBaseline(now: string = formatDateTimeLocal()): WriteBaseline {
	return {
		mode: 'create',
		originalSlug: null,
		form: {
			slug: '',
			title: '',
			md: '',
			tags: [],
			date: now,
			summary: '',
			hidden: false,
			category: '',
			folderPath: '',
			favorite: false
		},
		cover: null,
		images: []
	}
}

export function createEditWriteBaseline(snapshot: WriteSafetySnapshot): WriteBaseline {
	return cloneSnapshot(snapshot)
}

export function isWriteStateDirty(params: {
	baseline: WriteBaseline
	current: WriteSafetySnapshot
}): boolean {
	const { baseline, current } = params

	if (baseline.mode !== current.mode) {
		return true
	}

	if ((baseline.originalSlug ?? null) !== (current.originalSlug ?? null)) {
		return true
	}

	if (!areFormsEqual(baseline.form, current.form, baseline.mode)) {
		return true
	}

	if (JSON.stringify(getImageSignature(baseline.cover)) !== JSON.stringify(getImageSignature(current.cover))) {
		return true
	}

	if (!areImagesEqual(baseline.images, current.images)) {
		return true
	}

	if (hasUnresolvedLocalImagePlaceholders(current.form.md)) {
		return true
	}

	return false
}

export function resolveWriteDraftRestore(params: {
	draft: PersistedWriteDraft | null
	mode: WriteMode
	routeSlug?: string
	originalSlug?: string | null
}):
	| { shouldRestore: false; reason: RestoreFailureReason }
	| { shouldRestore: true; restored: WriteSafetySnapshot } {
	const { draft, mode, routeSlug, originalSlug } = params

	if (!draft) {
		return { shouldRestore: false, reason: 'missing-draft' }
	}

	if (draft.mode !== mode) {
		return { shouldRestore: false, reason: 'mode-mismatch' }
	}

	if (mode === 'create') {
		return {
			shouldRestore: true,
			restored: cloneSnapshot({
				mode: 'create',
				originalSlug: null,
				form: {
					slug: draft.form.slug ?? '',
					title: draft.form.title,
					md: draft.form.md,
					tags: [...draft.form.tags],
					date: draft.form.date,
					summary: draft.form.summary,
					hidden: draft.form.hidden,
					category: draft.form.category,
					folderPath: draft.form.folderPath,
					favorite: draft.form.favorite
				},
				cover: draft.coverUrl ? { id: 'draft-cover', type: 'url', url: draft.coverUrl } : null,
				images: draft.imageUrls.map((url, index) => ({ id: `draft-image-${index}`, type: 'url', url }))
			})
		}
	}

	const targetOriginalSlug = originalSlug ?? routeSlug ?? null
	if (!targetOriginalSlug) {
		return { shouldRestore: false, reason: 'slug-mismatch' }
	}

	if (!draft.originalSlug || draft.originalSlug !== targetOriginalSlug) {
		return { shouldRestore: false, reason: 'slug-mismatch' }
	}

	const restoredSnapshot = cloneSnapshot({
		mode: 'edit',
		originalSlug: targetOriginalSlug,
		form: {
			slug: targetOriginalSlug,
			title: draft.form.title,
			md: draft.form.md,
			tags: [...draft.form.tags],
			date: draft.form.date,
			summary: draft.form.summary,
			hidden: draft.form.hidden,
			category: draft.form.category,
			folderPath: draft.form.folderPath,
			favorite: draft.form.favorite
		},
		cover: draft.coverUrl ? { id: 'draft-cover', type: 'url', url: draft.coverUrl } : null,
		images: draft.imageUrls.map((url, index) => ({ id: `draft-image-${index}`, type: 'url', url }))
	})

	return {
		shouldRestore: true,
		restored: restoredSnapshot
	}
}

export function getWriteAutosaveState(params: {
	hasHydratedDraft: boolean
	isClearingDraft: boolean
}): { shouldEnableAutosave: boolean } {
	const { hasHydratedDraft, isClearingDraft } = params
	return {
		shouldEnableAutosave: hasHydratedDraft && !isClearingDraft
	}
}

export function getWritePublishSafetyState(params: {
	markdown: string
}): {
	shouldBlockPublishForUnresolvedLocalImages: boolean
	shouldShowUnresolvedLocalImageWarning: boolean
} {
	const hasUnresolvedLocalImages = hasUnresolvedLocalImagePlaceholders(params.markdown)

	return {
		shouldBlockPublishForUnresolvedLocalImages: hasUnresolvedLocalImages,
		shouldShowUnresolvedLocalImageWarning: hasUnresolvedLocalImages
	}
}

export function getWriteClearDraftState(params: {
	hasHydratedDraft: boolean
	isClearingDraft: boolean
}): { shouldBlockAutosaveRewrite: boolean } {
	const { hasHydratedDraft, isClearingDraft } = params
	return {
		shouldBlockAutosaveRewrite: !hasHydratedDraft || isClearingDraft
	}
}
