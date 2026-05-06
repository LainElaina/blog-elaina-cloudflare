import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('color preset cache normalizes persisted arrays before hydration', async () => {
	const source = await fs.readFile(new URL('./color-config.tsx', import.meta.url), 'utf-8')

	assert.match(source, /function normalizeColorPreset\(value: unknown, fallbackName = ''\): ColorPreset \| null \{\n\s*if \(!isObject\(value\)\) return null/)
	assert.match(source, /const name = typeof value\.name === 'string' && value\.name\.trim\(\) \? value\.name\.trim\(\) : fallbackName\.trim\(\)\n\s*if \(!name\) return null/)
	assert.match(source, /function normalizeColorPresets\(value: unknown\): ColorPreset\[\] \{\n\s*return Array\.isArray\(value\)\n\s*\? value\.map\(preset => normalizeColorPreset\(preset\)\)\.filter\(\(preset\): preset is ColorPreset => Boolean\(preset\)\)/)
	assert.match(source, /const parsed = JSON\.parse\(saved\)\n\s*if \(Array\.isArray\(parsed\)\) return normalizeColorPresets\(parsed\)/)
	assert.match(source, /\} catch \{\}\n\s*return normalizeColorPresets\(colorPresetsDefault\)/)
	assert.doesNotMatch(source, /if \(Array\.isArray\(parsed\)\) return parsed/)
	assert.doesNotMatch(source, /if \(saved\) return JSON\.parse\(saved\)/)
})

test('color preset import normalizes partial preset data', async () => {
	const source = await fs.readFile(new URL('./color-config.tsx', import.meta.url), 'utf-8')

	assert.match(source, /function normalizeTheme\(value: unknown\): Partial<SiteContent\['theme'\]> \{\n\s*if \(!isObject\(value\)\) return \{\}/)
	assert.match(source, /Object\.entries\(value\)\.filter\(\(\[key, color\]\) => key in DEFAULT_THEME_COLORS && typeof color === 'string'\)/)
	assert.match(source, /function normalizeBackgroundColors\(value: unknown\): string\[\] \{\n\s*return Array\.isArray\(value\) \? value\.filter\(\(color\): color is string => typeof color === 'string'\) : \[\]/)
	assert.match(source, /const newPreset = normalizeColorPreset\(config, file\.name\.replace\(\/\\\.json\$\/, ''\)\)/)
	assert.match(source, /if \(newPreset && \(Object\.keys\(newPreset\.theme\)\.length > 0 \|\| newPreset\.backgroundColors\.length > 0\)\) \{\n\s*saveCustomPresetsLocal\(\[\.\.\.customPresets, newPreset\]\)/)
	assert.doesNotMatch(source, /backgroundColors: config\.backgroundColors \|\| \[\]/)
	assert.doesNotMatch(source, /theme: hasTheme \? config\.theme : \{\}/)
})
