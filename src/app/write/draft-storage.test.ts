import assert from 'node:assert/strict'
import test from 'node:test'

import type { ImageItem, PublishForm } from './types'
import {
	WRITE_CREATE_DRAFT_KEY,
	WRITE_EDIT_DRAFT_KEY_PREFIX,
	clearWriteDraft,
	getWriteCreateDraftKey,
	getWriteDraftStorage,
	getWriteEditDraftKey,
	hasUnresolvedLocalImagePlaceholders,
	hasWriteDraft,
	readWriteDraft,
	serializeWriteDraft,
	writeWriteDraft,
	type PersistedWriteDraft,
	type WriteDraftStorageLike
} from './draft-storage'

type DraftablePublishForm = PublishForm & {
	folderPath?: string
	favorite?: boolean
}

const createMemoryStorage = (): WriteDraftStorageLike => {
	const entries = new Map<string, string>()

	return {
		getItem: key => entries.get(key) ?? null,
		setItem: (key, value) => {
			entries.set(key, value)
		},
		removeItem: key => {
			entries.delete(key)
		}
	}
}

const createThrowingStorage = (): WriteDraftStorageLike => ({
	getItem: () => {
		throw new Error('getItem failed')
	},
	setItem: () => {
		throw new Error('setItem failed')
	},
	removeItem: () => {
		throw new Error('removeItem failed')
	}
})

const createUrlImage = (id: string, url: string): ImageItem => ({
	id,
	type: 'url',
	url
})

const createFileImage = (id: string): ImageItem => ({
	id,
	type: 'file',
	file: { name: `${id}.png` } as File,
	previewUrl: `blob:${id}`,
	filename: `${id}.png`
})

const createForm = (overrides: Partial<DraftablePublishForm> = {}): DraftablePublishForm => ({
	slug: 'hello-world',
	title: 'Hello World',
	md: '![draft](local-image:abc)\n\ncontent',
	tags: ['alpha', 'beta'],
	date: '2026-04-21T10:00',
	summary: 'summary',
	hidden: true,
	category: 'notes',
	folderPath: 'content/posts',
	favorite: true,
	...overrides
})

test('create and edit draft keys use the expected values without collisions', () => {
	assert.equal(WRITE_CREATE_DRAFT_KEY, 'write:draft:create')
	assert.equal(WRITE_EDIT_DRAFT_KEY_PREFIX, 'write:draft:edit:')
	assert.equal(getWriteCreateDraftKey(), 'write:draft:create')
	assert.equal(getWriteEditDraftKey('post-slug'), 'write:draft:edit:post-slug')
	assert.notEqual(getWriteEditDraftKey('post-slug'), getWriteCreateDraftKey())
})

test('getWriteDraftStorage returns null for missing window-like objects or throwing getters', () => {
	assert.equal(getWriteDraftStorage(), null)
	assert.equal(getWriteDraftStorage(null), null)

	const storage = createMemoryStorage()
	assert.equal(getWriteDraftStorage({ localStorage: storage }), storage)

	const throwingWindowLike = Object.create(null, {
		localStorage: {
			get() {
				throw new Error('blocked localStorage')
			}
		}
	}) as { localStorage: WriteDraftStorageLike }

	assert.equal(getWriteDraftStorage(throwingWindowLike), null)
})

test('write read clear and has degrade safely when storage throws or is unavailable', () => {
	const draft: PersistedWriteDraft = {
		mode: 'create',
		form: {
			slug: 'hello-world',
			title: 'Hello World',
			md: 'content',
			tags: ['tag'],
			date: '2026-04-21T10:00',
			summary: 'summary',
			hidden: false,
			category: '',
			folderPath: '',
			favorite: false
		},
		coverUrl: null,
		imageUrls: []
	}

	const storage = createThrowingStorage()

	assert.doesNotThrow(() => writeWriteDraft(getWriteCreateDraftKey(), draft, storage))
	assert.equal(readWriteDraft(getWriteCreateDraftKey(), storage), null)
	assert.equal(hasWriteDraft(getWriteCreateDraftKey(), storage), false)
	assert.doesNotThrow(() => clearWriteDraft(getWriteCreateDraftKey(), storage))

	assert.doesNotThrow(() => writeWriteDraft(getWriteCreateDraftKey(), draft, null))
	assert.equal(readWriteDraft(getWriteCreateDraftKey(), null), null)
	assert.equal(hasWriteDraft(getWriteCreateDraftKey(), null), false)
	assert.doesNotThrow(() => clearWriteDraft(getWriteCreateDraftKey(), null))
})

test('write read clear and has round-trip drafts with readable storage', () => {
	const storage = createMemoryStorage()
	const draft: PersistedWriteDraft = {
		mode: 'create',
		form: {
			slug: 'hello-world',
			title: 'Hello World',
			md: 'content',
			tags: ['tag'],
			date: '2026-04-21T10:00',
			summary: 'summary',
			hidden: false,
			category: '',
			folderPath: '',
			favorite: false
		},
		coverUrl: 'https://example.com/cover.png',
		imageUrls: ['https://example.com/a.png']
	}

	writeWriteDraft(getWriteCreateDraftKey(), draft, storage)
	assert.equal(hasWriteDraft(getWriteCreateDraftKey(), storage), true)
	assert.deepEqual(readWriteDraft(getWriteCreateDraftKey(), storage), draft)

	clearWriteDraft(getWriteCreateDraftKey(), storage)
	assert.equal(hasWriteDraft(getWriteCreateDraftKey(), storage), false)
	assert.equal(readWriteDraft(getWriteCreateDraftKey(), storage), null)
})

test('serializeWriteDraft only persists allowed lightweight fields for create and edit drafts', () => {
	const form = createForm()

	const createDraft = serializeWriteDraft({
		mode: 'create',
		originalSlug: null,
		form,
		cover: createFileImage('cover-file'),
		images: [createUrlImage('url-image', 'https://example.com/image.png'), createFileImage('file-image')]
	})

	assert.deepEqual(createDraft, {
		mode: 'create',
		form: {
			slug: 'hello-world',
			title: 'Hello World',
			md: '![draft](local-image:abc)\n\ncontent',
			tags: ['alpha', 'beta'],
			date: '2026-04-21T10:00',
			summary: 'summary',
			hidden: true,
			category: 'notes',
			folderPath: 'content/posts',
			favorite: true
		},
		coverUrl: null,
		imageUrls: ['https://example.com/image.png']
	})

	const editDraft = serializeWriteDraft({
		mode: 'edit',
		originalSlug: 'original-post',
		form: createForm({ slug: 'edited-slug', hidden: undefined, category: undefined, folderPath: undefined, favorite: undefined }),
		cover: createUrlImage('cover-url', 'https://example.com/cover.png'),
		images: [createUrlImage('url-image', 'https://example.com/inline.png'), createFileImage('file-image')]
	})

	assert.deepEqual(editDraft, {
		mode: 'edit',
		originalSlug: 'original-post',
		form: {
			title: 'Hello World',
			md: '![draft](local-image:abc)\n\ncontent',
			tags: ['alpha', 'beta'],
			date: '2026-04-21T10:00',
			summary: 'summary',
			hidden: false,
			category: '',
			folderPath: '',
			favorite: false
		},
		coverUrl: 'https://example.com/cover.png',
		imageUrls: ['https://example.com/inline.png']
	})
	assert.equal('slug' in editDraft.form, false)
})

test('hasUnresolvedLocalImagePlaceholders detects unresolved markdown placeholders and ignores non-matching markdown', () => {
	assert.equal(hasUnresolvedLocalImagePlaceholders('![cover](local-image:abc123)'), true)
	assert.equal(hasUnresolvedLocalImagePlaceholders('[link](local-image:item-1)'), true)
	assert.equal(hasUnresolvedLocalImagePlaceholders('![cover](https://example.com/cover.png)'), false)
	assert.equal(hasUnresolvedLocalImagePlaceholders('local-image:abc123'), false)
	assert.equal(hasUnresolvedLocalImagePlaceholders('`![cover](local-image:abc123)`'), false)
	assert.equal(hasUnresolvedLocalImagePlaceholders('```md\n![cover](local-image:abc123)\n```'), false)
	assert.equal(hasUnresolvedLocalImagePlaceholders('(local-image:abc123)'), false)
})

test('readWriteDraft returns null for invalid JSON or invalid draft structure', () => {
	const storage = createMemoryStorage()

	storage.setItem(getWriteCreateDraftKey(), '{not-json')
	assert.equal(readWriteDraft(getWriteCreateDraftKey(), storage), null)

	storage.setItem(getWriteCreateDraftKey(), JSON.stringify({ mode: 'create' }))
	assert.equal(readWriteDraft(getWriteCreateDraftKey(), storage), null)
})
