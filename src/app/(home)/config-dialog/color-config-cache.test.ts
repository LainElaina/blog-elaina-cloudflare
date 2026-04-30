import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('color preset cache falls back when persisted value is not an array', async () => {
	const source = await fs.readFile(new URL('./color-config.tsx', import.meta.url), 'utf-8')

	assert.match(source, /const parsed = JSON\.parse\(saved\)\n\s*if \(Array\.isArray\(parsed\)\) return parsed/)
	assert.match(source, /\} catch \{\}\n\s*return colorPresetsDefault as ColorPreset\[\]/)
	assert.doesNotMatch(source, /if \(saved\) return JSON\.parse\(saved\)/)
})

test('color preset import normalizes partial preset data', async () => {
	const source = await fs.readFile(new URL('./color-config.tsx', import.meta.url), 'utf-8')

	assert.match(source, /const hasTheme = config\.theme && typeof config\.theme === 'object' && !Array\.isArray\(config\.theme\)/)
	assert.match(source, /const hasBackgroundColors = Array\.isArray\(config\.backgroundColors\)/)
	assert.match(source, /theme: hasTheme \? config\.theme : \{\},\n\s*backgroundColors: hasBackgroundColors \? config\.backgroundColors : \[\]/)
	assert.doesNotMatch(source, /backgroundColors: config\.backgroundColors \|\| \[\]/)
})
