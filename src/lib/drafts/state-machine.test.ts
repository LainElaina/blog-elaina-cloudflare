import assert from 'node:assert/strict'
import test from 'node:test'

import {
	beginPromotion,
	clearDraftAfterPromoted,
	createDraftState,
	markPromoteFailed,
	markPromoted,
	type DraftState
} from './state-machine.ts'
import { createManifestItem, type DraftManifestItem } from './manifest.ts'

function createSampleManifest(): DraftManifestItem {
	return createManifestItem({
		key: 'post:hello-world',
		type: 'blog',
		draftPath: 'drafts/blog/hello-world.md',
		formalPath: 'content/blog/hello-world.md',
		page: '/blog/hello-world',
		label: 'Hello World'
	})
}

test('createDraftState creates draft status with required metadata', () => {
	const state = createDraftState({
		id: 'd1',
		entityType: 'blog',
		entityKey: 'hello-world',
		baseVersion: 'v1',
		manifest: createSampleManifest()
	})

	assert.equal(state.status, 'draft')
	assert.equal(state.baseVersion, 'v1')
	assert.equal(state.lastError, null)
	assert.equal(state.errorCode, null)
	assert.equal(typeof state.createdAt, 'string')
	assert.equal(typeof state.updatedAt, 'string')
})

test('beginPromotion enters promoting when formal version matches baseVersion', () => {
	const draft = createDraftState({
		id: 'd2',
		entityType: 'blog',
		entityKey: 'hello-world',
		baseVersion: 'v1',
		manifest: createSampleManifest()
	})

	const result = beginPromotion(draft, { formalVersion: 'v1' })

	assert.equal(result.canWrite, true)
	assert.equal(result.error, null)
	assert.equal(result.next.status, 'promoting')
})

test('beginPromotion marks conflict and blocks write when formal version changed', () => {
	const draft = createDraftState({
		id: 'd3',
		entityType: 'blog',
		entityKey: 'hello-world',
		baseVersion: 'v1',
		manifest: createSampleManifest()
	})

	const result = beginPromotion(draft, { formalVersion: 'v2' })

	assert.equal(result.canWrite, false)
	assert.equal(result.next.status, 'conflict')
	assert.equal(result.error?.code, 'FORMAL_VERSION_CONFLICT')
	assert.match(result.error?.message ?? '', /冲突|conflict/i)
})

test('markPromoteFailed keeps draft and stores minimal error metadata', () => {
	const draft = createDraftState({
		id: 'd4',
		entityType: 'blog',
		entityKey: 'hello-world',
		baseVersion: 'v1',
		manifest: createSampleManifest()
	})
	const promoting = beginPromotion(draft, { formalVersion: 'v1' }).next
	assert.equal(promoting.status, 'promoting')

	const failed = markPromoteFailed(promoting, {
		code: 'WRITE_FAILED',
		message: 'write failed due to disk error'
	})

	assert.equal(failed.status, 'promote_failed')
	assert.equal(failed.lastError, 'write failed due to disk error')
	assert.equal(failed.errorCode, 'WRITE_FAILED')
	assert.equal(typeof failed.errorAt, 'string')
	assert.equal(failed.id, draft.id)
	assert.equal(failed.baseVersion, draft.baseVersion)
})

test('markPromoted then clearDraftAfterPromoted removes draft state after success', () => {
	const draft = createDraftState({
		id: 'd5',
		entityType: 'blog',
		entityKey: 'hello-world',
		baseVersion: 'v1',
		manifest: createSampleManifest()
	})
	const promoting = beginPromotion(draft, { formalVersion: 'v1' }).next

	const promoted: DraftState = markPromoted(promoting)
	assert.equal(promoted.status, 'promoted')

	const cleared = clearDraftAfterPromoted(promoted)
	assert.equal(cleared, null)
})

test('createManifestItem fills required fields and updatedAt', () => {
	const item = createSampleManifest()
	assert.equal(item.key, 'post:hello-world')
	assert.equal(item.type, 'blog')
	assert.equal(item.draftPath, 'drafts/blog/hello-world.md')
	assert.equal(item.formalPath, 'content/blog/hello-world.md')
	assert.equal(item.page, '/blog/hello-world')
	assert.equal(item.label, 'Hello World')
	assert.equal(typeof item.updatedAt, 'string')
})
