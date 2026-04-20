import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildPicturesPageDisplayModeState } from './page-view-model'

describe('pictures page display mode wiring', () => {
	it('keeps page-level onDisplayModeChange connected to preferred display mode state', () => {
		const calls = []
		const initialState = buildPicturesPageDisplayModeState({
			preferredDisplayMode: 'random',
			isEditMode: false,
			isMobile: false,
			onDisplayModeChange: mode => calls.push(mode)
		})

		initialState.onDisplayModeChange('masonry')
		const nextState = buildPicturesPageDisplayModeState({
			preferredDisplayMode: 'masonry',
			isEditMode: false,
			isMobile: false,
			onDisplayModeChange: mode => calls.push(mode)
		})

		assert.equal(initialState.effectiveDisplayMode, 'random')
		assert.equal(nextState.effectiveDisplayMode, 'masonry')
		assert.deepEqual(calls, ['masonry'])
	})

	it('forces the page-level effective display mode back to random on mobile', () => {
		const state = buildPicturesPageDisplayModeState({
			preferredDisplayMode: 'masonry',
			isEditMode: false,
			isMobile: true,
			onDisplayModeChange: () => undefined
		})

		assert.equal(state.effectiveDisplayMode, 'random')
	})
})
