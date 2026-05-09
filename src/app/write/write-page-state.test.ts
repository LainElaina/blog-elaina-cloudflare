import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { registerHooks } from 'node:module'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import type { ImageItem } from './types'

function resolveProjectModule(baseUrl: URL, specifier: string) {
	const directUrl = new URL(specifier, baseUrl)
	if (existsSync(fileURLToPath(directUrl))) {
		return directUrl.href
	}

	for (const extension of ['.ts', '.tsx', '.js', '.jsx', '.json']) {
		const url = new URL(`${specifier}${extension}`, baseUrl)
		if (existsSync(fileURLToPath(url))) {
			return url.href
		}
	}

	return null
}

registerHooks({
	resolve(specifier, context, nextResolve) {
		if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL) {
			const url = resolveProjectModule(new URL(context.parentURL), specifier)
			if (url) return { shortCircuit: true, url }
		}
		return nextResolve(specifier, context)
	}
})

const { getRestoredPlaceholderWarningState, getWritePageAutosaveKey, getWritePageDraftKey, shouldProtectWritePageBeforeUnload } = await import('./write-page-state.ts')

const createFileImage = (id: string): Extract<ImageItem, { type: 'file' }> => ({
	id,
	type: 'file',
	file: {
		name: `${id}.png`,
		size: 1,
		type: 'image/png',
		lastModified: 1
	} as File,
	previewUrl: `blob:${id}`,
	filename: `${id}.png`,
	hash: `${id}-hash`
})

test('create page chooses the create draft key', () => {
	assert.equal(getWritePageDraftKey({ mode: 'create' }), 'write:draft:create')
})

test('edit page chooses a draft key only after the matching blog has loaded', () => {
	assert.equal(getWritePageDraftKey({ mode: 'edit', routeSlug: 'hello-world', loadedOriginalSlug: 'hello-world', hasLoadedBlog: false }), null)
	assert.equal(getWritePageDraftKey({ mode: 'edit', routeSlug: 'hello-world', loadedOriginalSlug: 'other-post', hasLoadedBlog: true }), null)
	assert.equal(
		getWritePageDraftKey({ mode: 'edit', routeSlug: 'hello-world', loadedOriginalSlug: 'hello-world', hasLoadedBlog: true }),
		'write:draft:edit:hello-world'
	)
})

test('autosave stays disabled before hydration and enables after hydration', () => {
	assert.equal(getWritePageAutosaveKey({ mode: 'create', hasHydratedDraft: false }), null)
	assert.equal(getWritePageAutosaveKey({ mode: 'create', hasHydratedDraft: true }), 'write:draft:create')
})

test('autosave stays disabled while draft clear is in progress', () => {
	assert.equal(getWritePageAutosaveKey({ mode: 'create', hasHydratedDraft: true, isClearingDraft: true }), null)
})

test('beforeunload protection activates only when hydrated and dirty', () => {
	assert.equal(shouldProtectWritePageBeforeUnload({ hasHydratedDraft: false, isDirty: true }), false)
	assert.equal(shouldProtectWritePageBeforeUnload({ hasHydratedDraft: true, isDirty: false }), false)
	assert.equal(shouldProtectWritePageBeforeUnload({ hasHydratedDraft: true, isDirty: true }), true)
})

test('restored unresolved placeholders produce a warning state', () => {
	assert.deepEqual(
		getRestoredPlaceholderWarningState({
			hasRestoredDraft: true,
			markdown: '![pending](local-image:pending-1)',
			images: []
		}),
		{
			shouldShowWarning: true,
			unresolvedPlaceholderIds: ['pending-1']
		}
	)
})

test('live in-memory file images prevent restored-placeholder warning', () => {
	assert.deepEqual(
		getRestoredPlaceholderWarningState({
			hasRestoredDraft: true,
			markdown: '![local](local-image:live-1)',
			images: [createFileImage('live-1')]
		}),
		{
			shouldShowWarning: false,
			unresolvedPlaceholderIds: []
		}
	)
})
