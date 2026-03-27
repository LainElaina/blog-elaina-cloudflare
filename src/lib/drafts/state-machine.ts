import type { DraftManifestItem } from './manifest.ts'

export type DraftStatus = 'draft' | 'promoting' | 'conflict' | 'promote_failed' | 'promoted'

export type DraftState = {
	id: string
	entityType: string
	entityKey: string
	status: DraftStatus
	manifest: DraftManifestItem
	baseVersion: string | null
	lastError: string | null
	errorCode: string | null
	errorAt: string | null
	createdAt: string
	updatedAt: string
}

export type TransitionError = {
	code: string
	message: string
	at: string
}

export type BeginPromotionResult = {
	next: DraftState
	canWrite: boolean
	error: TransitionError | null
}

export function createDraftState(input: {
	id: string
	entityType: string
	entityKey: string
	manifest: DraftManifestItem
	baseVersion?: string | null
	now?: string
}): DraftState {
	const now = input.now ?? new Date().toISOString()
	return {
		id: input.id,
		entityType: input.entityType,
		entityKey: input.entityKey,
		status: 'draft',
		manifest: input.manifest,
		baseVersion: input.baseVersion ?? null,
		lastError: null,
		errorCode: null,
		errorAt: null,
		createdAt: now,
		updatedAt: now
	}
}

export function beginPromotion(current: DraftState, input: { formalVersion: string | null; now?: string }): BeginPromotionResult {
	const now = input.now ?? new Date().toISOString()
	if (current.baseVersion !== input.formalVersion) {
		const conflictError: TransitionError = {
			code: 'FORMAL_VERSION_CONFLICT',
			message: 'formal content version conflict detected before write',
			at: now
		}

		return {
			next: {
				...current,
				status: 'conflict',
				lastError: conflictError.message,
				errorCode: conflictError.code,
				errorAt: conflictError.at,
				updatedAt: now
			},
			canWrite: false,
			error: conflictError
		}
	}

	return {
		next: {
			...current,
			status: 'promoting',
			lastError: null,
			errorCode: null,
			errorAt: null,
			updatedAt: now
		},
		canWrite: true,
		error: null
	}
}

export function markPromoteFailed(current: DraftState, input: { code: string; message: string; now?: string }): DraftState {
	const now = input.now ?? new Date().toISOString()
	return {
		...current,
		status: 'promote_failed',
		lastError: input.message,
		errorCode: input.code,
		errorAt: now,
		updatedAt: now
	}
}

export function markPromoted(current: DraftState, now: string = new Date().toISOString()): DraftState {
	return {
		...current,
		status: 'promoted',
		lastError: null,
		errorCode: null,
		errorAt: null,
		updatedAt: now
	}
}

export function clearDraftAfterPromoted(current: DraftState): null | DraftState {
	if (current.status === 'promoted') {
		return null
	}
	return current
}
