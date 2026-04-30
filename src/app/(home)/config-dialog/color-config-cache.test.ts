import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('color preset cache falls back when persisted value is not an array', async () => {
	const source = await fs.readFile(new URL('./color-config.tsx', import.meta.url), 'utf-8')

	assert.match(source, /const parsed = JSON\.parse\(saved\)\n\s*if \(Array\.isArray\(parsed\)\) return parsed/)
	assert.match(source, /\} catch \{\}\n\s*return colorPresetsDefault as ColorPreset\[\]/)
	assert.doesNotMatch(source, /if \(saved\) return JSON\.parse\(saved\)/)
})
