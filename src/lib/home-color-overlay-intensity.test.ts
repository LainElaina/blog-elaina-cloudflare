import assert from 'node:assert/strict'
import test from 'node:test'

const { normalizeHomeColorOverlayIntensity, getAtmosphereOverlayProfile } = await import(new URL('./home-color-overlay-intensity.ts', import.meta.url).href)

test('normalizeHomeColorOverlayIntensity returns default for invalid values', () => {
	assert.equal(normalizeHomeColorOverlayIntensity(undefined), 'default')
	assert.equal(normalizeHomeColorOverlayIntensity(''), 'default')
	assert.equal(normalizeHomeColorOverlayIntensity('unknown'), 'default')
})

test('normalizeHomeColorOverlayIntensity keeps supported values', () => {
	assert.equal(normalizeHomeColorOverlayIntensity('default'), 'default')
	assert.equal(normalizeHomeColorOverlayIntensity('light'), 'light')
})

test('getAtmosphereOverlayProfile returns original values for default intensity', () => {
	assert.deepEqual(getAtmosphereOverlayProfile('default'), {
		staticBlur: 50,
		staticBubbles: [
			{ size: 34, left: '-4%', bottom: '-8%', opacity: 0.48 },
			{ size: 38, left: '28%', bottom: '-12%', opacity: 0.42 },
			{ size: 30, right: '-5%', bottom: '-6%', opacity: 0.4 }
		],
		dynamicBubbleCount: 6,
		dynamicBottomBandStart: 0.8
	})
})

test('getAtmosphereOverlayProfile returns lighter and smaller values for light intensity', () => {
	const light = getAtmosphereOverlayProfile('light')
	const normal = getAtmosphereOverlayProfile('default')

	assert.equal(light.staticBlur < normal.staticBlur, true)
	assert.equal(light.dynamicBubbleCount < normal.dynamicBubbleCount, true)
	assert.equal(light.dynamicBottomBandStart > normal.dynamicBottomBandStart, true)
	assert.equal(light.staticBubbles.every((bubble: (typeof light.staticBubbles)[number], index: number) => bubble.size < normal.staticBubbles[index].size), true)
	assert.equal(light.staticBubbles.every((bubble: (typeof light.staticBubbles)[number], index: number) => bubble.opacity < normal.staticBubbles[index].opacity), true)
})
