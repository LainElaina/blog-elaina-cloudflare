import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { normalizeSavedPictureOffset } from './random-layout-offset.ts'

describe('random-layout-offset', () => {
	it('非对象 offset 会回退到原点', () => {
		assert.deepEqual(normalizeSavedPictureOffset(null), { x: 0, y: 0 })
		assert.deepEqual(normalizeSavedPictureOffset([10, 20]), { x: 0, y: 0 })
	})

	it('非有限数值字段会分别回退到 0', () => {
		assert.deepEqual(normalizeSavedPictureOffset({ x: Number.NaN, y: 12 }), { x: 0, y: 12 })
		assert.deepEqual(normalizeSavedPictureOffset({ x: 8, y: Number.POSITIVE_INFINITY }), { x: 8, y: 0 })
		assert.deepEqual(normalizeSavedPictureOffset({ x: '8', y: false }), { x: 0, y: 0 })
	})
})
