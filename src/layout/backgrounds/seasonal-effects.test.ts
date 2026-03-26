import assert from 'node:assert/strict'
import test from 'node:test'

const { getSeasonalLayers } = await import(new URL('./seasonal-effects-config.ts', import.meta.url).href)
const renderHelpers = await import(new URL('./seasonal-effects-render.ts', import.meta.url).href)
const requireRenderHelpers = () => renderHelpers

test('spring vivid has stronger primary layer than spring light', () => {
	const light = getSeasonalLayers('spring', 'light')
	const vivid = getSeasonalLayers('spring', 'vivid')

	assert.equal(light.kind, 'layers')
	assert.equal(vivid.kind, 'layers')
	if (light.kind !== 'layers' || vivid.kind !== 'layers') return

	assert.ok(vivid.primary.count > light.primary.count)
	assert.ok(vivid.primary.opacity >= light.primary.opacity)
	assert.ok(vivid.secondary.count > light.secondary.count)
})

test('summer layers separate orange soda bubbles and sunlight glow', () => {
	const summer = getSeasonalLayers('summer', 'mixed')

	assert.equal(summer.kind, 'layers')
	if (summer.kind !== 'layers') return

	assert.equal(summer.primary.shape, 'bubble')
	assert.equal(summer.secondary.shape, 'softGlow')
	assert.ok(summer.primary.colors.some((color: string) => ['#ffd166', '#ffbf69', '#f4a261'].includes(color)))
	assert.ok(summer.secondary.colors.some((color: string) => ['#fff4a3', '#ffe066', '#fff1b8'].includes(color)))
})

test('autumn primary layer uses maple-like leaves', () => {
	const autumn = getSeasonalLayers('autumn', 'mixed')

	assert.equal(autumn.kind, 'layers')
	if (autumn.kind !== 'layers') return

	assert.equal(autumn.primary.shape, 'maple')
})


test('spring uses petal primary layer and soft glow secondary layer', () => {
	const spring = getSeasonalLayers('spring', 'mixed')

	assert.equal(spring.kind, 'layers')
	if (spring.kind !== 'layers') return

	assert.equal(spring.primary.shape, 'petal')
	assert.equal(spring.secondary.shape, 'softGlow')
})

test('summer uses rising bubbles and sunlight glow', () => {
	const summer = getSeasonalLayers('summer', 'vivid')

	assert.equal(summer.kind, 'layers')
	if (summer.kind !== 'layers') return

	assert.equal(summer.primary.movement, 'rise')
	assert.equal(summer.secondary.shape, 'softGlow')
})


test('render helper returns rise animation with upward movement', () => {
	const { getParticleAnimation } = requireRenderHelpers()
	const animation = getParticleAnimation({ driftX: 12, driftY: 18, rotate: 30 }, 'rise', false)

	assert.deepEqual(animation.y, [0, -18, -32.4])
})


test('spring style progression increases both layers', () => {
	const light = getSeasonalLayers('spring', 'light')
	const mixed = getSeasonalLayers('spring', 'mixed')
	const vivid = getSeasonalLayers('spring', 'vivid')

	assert.equal(light.kind, 'layers')
	assert.equal(mixed.kind, 'layers')
	assert.equal(vivid.kind, 'layers')
	if (light.kind !== 'layers' || mixed.kind !== 'layers' || vivid.kind !== 'layers') return

	assert.ok(light.primary.count < mixed.primary.count)
	assert.ok(mixed.primary.count < vivid.primary.count)
	assert.ok(light.secondary.opacity <= mixed.secondary.opacity)
	assert.ok(mixed.secondary.opacity <= vivid.secondary.opacity)
})

test('summer vivid is stronger than light without changing season language', () => {
	const light = getSeasonalLayers('summer', 'light')
	const vivid = getSeasonalLayers('summer', 'vivid')

	assert.equal(light.kind, 'layers')
	assert.equal(vivid.kind, 'layers')
	if (light.kind !== 'layers' || vivid.kind !== 'layers') return

	assert.equal(vivid.primary.shape, 'bubble')
	assert.ok(vivid.primary.count > light.primary.count)
	assert.ok(vivid.secondary.count >= light.secondary.count)
})
