import assert from 'node:assert/strict'
import test from 'node:test'

const { SEASONAL_STYLE_OPTIONS } = await import(new URL('./seasonal-effects-config.ts', import.meta.url).href)

test('seasonal style options are ordered and labeled in Chinese', () => {
	assert.deepEqual(SEASONAL_STYLE_OPTIONS, [
		{ value: 'light', label: '轻量' },
		{ value: 'mixed', label: '中等' },
		{ value: 'vivid', label: '明显' }
	])
})
