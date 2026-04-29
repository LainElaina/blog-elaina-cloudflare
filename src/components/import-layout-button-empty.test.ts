import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('layout config import preserves explicit empty arrays', async () => {
	const source = await fs.readFile(new URL('./import-layout-button.tsx', import.meta.url), 'utf-8')

	assert.match(source, /if \(Array\.isArray\(config\.customComponents\)\) \{\n\s*localStorage\.setItem\('custom-components', JSON\.stringify\(config\.customComponents\)\)/)
	assert.match(source, /if \(Array\.isArray\(config\.componentFavorites\)\) \{\n\s*localStorage\.setItem\('component-favorites', JSON\.stringify\(config\.componentFavorites\)\)/)
	assert.match(source, /if \(Array\.isArray\(config\.templates\)\) \{\n\s*localStorage\.setItem\('templates', JSON\.stringify\(config\.templates\)\)/)
	assert.doesNotMatch(source, /if \(config\.customComponents\) \{/)
	assert.doesNotMatch(source, /if \(config\.componentFavorites\) \{/)
	assert.doesNotMatch(source, /if \(config\.templates\) \{/)
})
