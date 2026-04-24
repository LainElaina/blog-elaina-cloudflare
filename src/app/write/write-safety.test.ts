import test from 'node:test'
import assert from 'node:assert/strict'
import type { ImageItem, PublishForm } from './types'
import {
	createEditWriteBaseline,
	createEmptyWriteBaseline,
	getWriteAutosaveState,
	getWriteClearDraftState,
	getWritePublishSafetyState,
	isWriteSnapshotEquivalent,
	isWriteStateDirty,
	resolveWriteDraftRestore,
	type WriteSafetySnapshot
} from './write-safety'
import type { PersistedWriteDraft } from './draft-storage'

type ExtendedPublishForm = PublishForm & {
	folderPath?: string
	favorite?: boolean
}

const createForm = (overrides: Partial<ExtendedPublishForm> = {}): PublishForm => ({
	slug: 'hello-world',
	title: 'Hello world',
	md: '# Hello world',
	tags: ['blog'],
	date: '2026-04-21T09:30',
	summary: 'summary',
	hidden: false,
	category: 'notes',
	folderPath: '',
	favorite: false,
	...overrides
})

const createUrlImage = (url: string, id = url): ImageItem => ({ id, type: 'url', url })

const createFileImage = (overrides: Partial<Extract<ImageItem, { type: 'file' }>> = {}): Extract<ImageItem, { type: 'file' }> => ({
	id: overrides.id ?? 'file-image',
	type: 'file',
	file: (overrides.file ?? {
		name: 'local.png',
		size: 12,
		type: 'image/png',
		lastModified: 1
	}) as File,
	previewUrl: overrides.previewUrl ?? 'blob:local.png',
	filename: overrides.filename ?? 'local.png',
	hash: overrides.hash ?? 'hash-local'
})

const createSnapshot = (overrides: Partial<WriteSafetySnapshot> = {}): WriteSafetySnapshot => ({
	mode: 'edit',
	originalSlug: 'hello-world',
	form: createForm(),
	cover: createUrlImage('/blogs/hello-world/cover.png', 'cover'),
	images: [createUrlImage('/blogs/hello-world/image.png', 'image')],
	...overrides
})

test('createEmptyWriteBaseline returns create defaults', () => {
	assert.deepEqual(createEmptyWriteBaseline('2026-04-21T12:34'), {
		mode: 'create',
		originalSlug: null,
		form: {
			slug: '',
			title: '',
			md: '',
			tags: [],
			date: '2026-04-21T12:34',
			summary: '',
			hidden: false,
			category: '',
			folderPath: '',
			favorite: false
		},
		cover: null,
		images: []
	})
})

test('createEditWriteBaseline mirrors loaded published snapshot', () => {
	const snapshot = createSnapshot({
		form: createForm({ title: 'Loaded title', summary: 'Loaded summary', folderPath: '/notes', favorite: true }),
		cover: createUrlImage('/blogs/hello-world/loaded-cover.png', 'loaded-cover'),
		images: [createUrlImage('/blogs/hello-world/loaded-1.png', 'loaded-1'), createUrlImage('/blogs/hello-world/loaded-2.png', 'loaded-2')]
	})

	assert.deepEqual(createEditWriteBaseline(snapshot), snapshot)
})

test('restored draft content remains dirty relative to create baseline', () => {
	const baseline = createEmptyWriteBaseline('2026-04-21T12:34')
	const draft: PersistedWriteDraft = {
		mode: 'create',
		form: {
			slug: 'draft-post',
			title: 'Draft title',
			md: 'Draft body',
			tags: ['draft'],
			date: '2026-04-21T12:40',
			summary: 'draft summary',
			hidden: false,
			category: 'notes',
			folderPath: '/drafts',
			favorite: true
		},
		coverUrl: null,
		imageUrls: []
	}

	const restored = resolveWriteDraftRestore({ draft, mode: 'create' })
	assert.equal(restored.shouldRestore, true)
	if (!restored.shouldRestore) throw new Error('expected restore success')

	assert.equal(isWriteStateDirty({ baseline, current: restored.restored }), true)
})

test('create draft never restores onto edit page', () => {
	const draft: PersistedWriteDraft = {
		mode: 'create',
		form: {
			slug: 'draft-post',
			title: 'Draft title',
			md: 'Draft body',
			tags: [],
			date: '2026-04-21T12:40',
			summary: '',
			hidden: false,
			category: '',
			folderPath: '',
			favorite: false
		},
		coverUrl: null,
		imageUrls: []
	}

	assert.deepEqual(resolveWriteDraftRestore({ draft, mode: 'edit', routeSlug: 'hello-world', originalSlug: 'hello-world' }), {
		shouldRestore: false,
		reason: 'mode-mismatch'
	})
})

test('edit draft restores only when original slug matches and sanitizes slug', () => {
	const draft: PersistedWriteDraft = {
		mode: 'edit',
		originalSlug: 'hello-world',
		form: {
			title: 'Draft edit title',
			md: 'Draft body',
			tags: ['draft'],
			date: '2026-04-21T12:40',
			summary: 'draft summary',
			hidden: false,
			category: 'notes',
			folderPath: '/drafts',
			favorite: false
		},
		coverUrl: 'https://example.com/cover.png',
		imageUrls: ['https://example.com/image.png']
	}

	const restored = resolveWriteDraftRestore({ draft, mode: 'edit', routeSlug: 'hello-world' })
	assert.equal(restored.shouldRestore, true)
	if (!restored.shouldRestore) throw new Error('expected restore success')

	assert.equal(restored.restored.originalSlug, 'hello-world')
	assert.equal(restored.restored.form.slug, 'hello-world')
	assert.equal(restored.restored.form.title, 'Draft edit title')
	assert.deepEqual(restored.restored.cover, {
		id: 'draft-cover',
		type: 'url',
		url: 'https://example.com/cover.png'
	})
	assert.deepEqual(restored.restored.images, [{ id: 'draft-image-0', type: 'url', url: 'https://example.com/image.png' }])
	assert.equal('coverUrl' in restored.restored, false)
	assert.equal('imageUrls' in restored.restored, false)
})

test('edit draft with mismatched slug is rejected', () => {
	const draft: PersistedWriteDraft = {
		mode: 'edit',
		originalSlug: 'other-post',
		form: {
			title: 'Other draft',
			md: 'Draft body',
			tags: [],
			date: '2026-04-21T12:40',
			summary: '',
			hidden: false,
			category: '',
			folderPath: '',
			favorite: false
		},
		coverUrl: null,
		imageUrls: []
	}

	assert.deepEqual(resolveWriteDraftRestore({ draft, mode: 'edit', routeSlug: 'hello-world', originalSlug: 'hello-world' }), {
		shouldRestore: false,
		reason: 'slug-mismatch'
	})
})

test('autosave stays disabled until hydration completes and while clearing', () => {
	assert.deepEqual(getWriteAutosaveState({ hasHydratedDraft: false, isClearingDraft: false }), {
		shouldEnableAutosave: false
	})
	assert.deepEqual(getWriteAutosaveState({ hasHydratedDraft: true, isClearingDraft: true }), {
		shouldEnableAutosave: false
	})
	assert.deepEqual(getWriteAutosaveState({ hasHydratedDraft: true, isClearingDraft: false }), {
		shouldEnableAutosave: true
	})
})

test('unresolved local-image placeholders block publish and live file images are allowed', () => {
	assert.deepEqual(getWritePublishSafetyState({ markdown: '![local](local-image:abc123)', images: [] }), {
		shouldBlockPublishForUnresolvedLocalImages: true,
		shouldShowUnresolvedLocalImageWarning: true,
		unresolvedLocalImagePlaceholderIds: ['abc123']
	})
	assert.deepEqual(getWritePublishSafetyState({ markdown: '![local](local-image:live-image)', images: [createFileImage({ id: 'live-image' })] }), {
		shouldBlockPublishForUnresolvedLocalImages: false,
		shouldShowUnresolvedLocalImageWarning: false,
		unresolvedLocalImagePlaceholderIds: []
	})
	assert.deepEqual(getWritePublishSafetyState({ markdown: '![remote](/blogs/hello-world/image.png)', images: [] }), {
		shouldBlockPublishForUnresolvedLocalImages: false,
		shouldShowUnresolvedLocalImageWarning: false,
		unresolvedLocalImagePlaceholderIds: []
	})
})

test('clear-draft transaction blocks autosave rewrite', () => {
	assert.deepEqual(getWriteClearDraftState({ hasHydratedDraft: false, isClearingDraft: false }), {
		shouldBlockAutosaveRewrite: true
	})
	assert.deepEqual(getWriteClearDraftState({ hasHydratedDraft: true, isClearingDraft: true }), {
		shouldBlockAutosaveRewrite: true
	})
	assert.deepEqual(getWriteClearDraftState({ hasHydratedDraft: true, isClearingDraft: false }), {
		shouldBlockAutosaveRewrite: false
	})
})

test('snapshot equivalence ignores unresolved placeholder dirtiness and detects real edits', () => {
	const baseline = createSnapshot({
		form: createForm({ md: '![local](local-image:pending)' })
	})

	assert.equal(isWriteSnapshotEquivalent({ baseline, current: createSnapshot({ form: createForm({ md: '![local](local-image:pending)' }) }) }), true)
	assert.equal(isWriteSnapshotEquivalent({ baseline, current: createSnapshot({ form: createForm({ md: 'changed' }) }) }), false)
})

test('dirty state allows local-image placeholders backed by live file images', () => {
	const snapshot = createSnapshot({
		form: createForm({ md: '![local](local-image:live-file)' }),
		images: [createFileImage({ id: 'live-file' })]
	})

	assert.equal(
		isWriteStateDirty({
			baseline: createEditWriteBaseline(snapshot),
			current: snapshot
		}),
		false
	)
})

test('dirty state treats unresolved local-image placeholders as dirty', () => {
	const snapshot = createSnapshot({
		form: createForm({ md: '![local](local-image:pending)' })
	})

	assert.equal(
		isWriteStateDirty({
			baseline: createEditWriteBaseline(snapshot),
			current: createSnapshot({ form: createForm({ md: '![local](local-image:pending)' }) })
		}),
		true
	)
})

test('dirty state tracks URL, file, create-slug, folderPath, favorite, and ignores edit slug drift', () => {
	const baseline = createEditWriteBaseline(createSnapshot())

	const sameValuesDifferentIds = createSnapshot({
		form: createForm({ slug: 'changed-edit-slug' }),
		cover: createUrlImage('/blogs/hello-world/cover.png', 'different-cover-id'),
		images: [createUrlImage('/blogs/hello-world/image.png', 'different-image-id')]
	})
	assert.equal(isWriteStateDirty({ baseline, current: sameValuesDifferentIds }), false)

	assert.equal(
		isWriteStateDirty({
			baseline,
			current: createSnapshot({ cover: createUrlImage('/blogs/hello-world/cover-2.png', 'cover-2') })
		}),
		true
	)

	assert.equal(
		isWriteStateDirty({
			baseline,
			current: createSnapshot({ images: [createUrlImage('/blogs/hello-world/image-2.png', 'image-2')] })
		}),
		true
	)

	assert.equal(
		isWriteStateDirty({
			baseline,
			current: createSnapshot({ images: [createFileImage()] })
		}),
		true
	)

	assert.equal(
		isWriteStateDirty({
			baseline,
			current: createSnapshot({
				cover: createFileImage({ id: 'cover-file', filename: 'cover.png', previewUrl: 'blob:cover.png', hash: 'hash-cover' })
			})
		}),
		true
	)

	const extraBaseline = createEditWriteBaseline(
		createSnapshot({
			form: createForm({ folderPath: 'notes', favorite: false } as ExtendedPublishForm)
		})
	)

	assert.equal(
		isWriteStateDirty({
			baseline: extraBaseline,
			current: createSnapshot({ form: createForm({ folderPath: 'journal', favorite: false } as ExtendedPublishForm) })
		}),
		true
	)

	assert.equal(
		isWriteStateDirty({
			baseline: extraBaseline,
			current: createSnapshot({ form: createForm({ folderPath: 'notes', favorite: true } as ExtendedPublishForm) })
		}),
		true
	)

	const createBaseline = createEmptyWriteBaseline('2026-04-21T12:34')
	assert.equal(
		isWriteStateDirty({
			baseline: createBaseline,
			current: {
				...createBaseline,
				form: {
					...createBaseline.form,
					slug: 'new-slug'
				}
			}
		}),
		true
	)
})
