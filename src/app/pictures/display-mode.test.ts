import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	PICTURES_DISPLAY_MODE_PERSISTENCE,
	PICTURES_DISPLAY_MODE_SESSION_STORAGE_KEY,
	readPicturesDisplayModeFromSessionStorage,
	resolvePicturesEffectiveDisplayMode,
	writePicturesDisplayModeToSessionStorage,
	normalizePicturesDisplayMode
} from './display-mode'

describe('pictures display mode state machine', () => {
	it('default preferredDisplayMode normalizes to random', () => {
		assert.equal(normalizePicturesDisplayMode(undefined), 'random')
	})

	it('invalid stored values fall back to random', () => {
		assert.equal(normalizePicturesDisplayMode('grid'), 'random')
		assert.equal(normalizePicturesDisplayMode(''), 'random')
	})

	it('desktop browse mode resolves to preferredDisplayMode', () => {
		assert.equal(
			resolvePicturesEffectiveDisplayMode({
				preferredDisplayMode: 'random',
				isEditMode: false,
				isMobile: false
			}),
			'random'
		)
		assert.equal(
			resolvePicturesEffectiveDisplayMode({
				preferredDisplayMode: 'masonry',
				isEditMode: false,
				isMobile: false
			}),
			'masonry'
		)
	})

	it('edit mode forces effectiveDisplayMode to random', () => {
		assert.equal(
			resolvePicturesEffectiveDisplayMode({
				preferredDisplayMode: 'masonry',
				isEditMode: true,
				isMobile: false
			}),
			'random'
		)
	})

	it('mobile viewport forces effectiveDisplayMode to random', () => {
		assert.equal(
			resolvePicturesEffectiveDisplayMode({
				preferredDisplayMode: 'masonry',
				isEditMode: false,
				isMobile: true
			}),
			'random'
		)
	})

	it('models persistence as a sessionStorage-only concern', () => {
		const calls: Array<[string, string, string?]> = []
		const storage = {
			getItem(key: string) {
				calls.push(['getItem', key])
				return 'masonry'
			},
			setItem(key: string, value: string) {
				calls.push(['setItem', key, value])
			}
		}

		assert.equal(PICTURES_DISPLAY_MODE_PERSISTENCE, 'sessionStorage')
		assert.equal(PICTURES_DISPLAY_MODE_SESSION_STORAGE_KEY, 'pictures-display-mode')
		assert.equal(readPicturesDisplayModeFromSessionStorage(storage), 'masonry')
		writePicturesDisplayModeToSessionStorage('random', storage)
		assert.deepEqual(calls, [
			['getItem', 'pictures-display-mode'],
			['setItem', 'pictures-display-mode', 'random']
		])
	})

	it('falls back to random when sessionStorage is unavailable or throws', () => {
		assert.equal(readPicturesDisplayModeFromSessionStorage(), 'random')

		const throwingStorage = {
			getItem() {
				throw new Error('blocked')
			},
			setItem() {
				throw new Error('blocked')
			}
		}

		assert.equal(readPicturesDisplayModeFromSessionStorage(throwingStorage), 'random')
		assert.doesNotThrow(() => {
			writePicturesDisplayModeToSessionStorage('masonry', throwingStorage)
		})
	})
})
