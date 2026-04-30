import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('component store hydrates explicit empty cached lists', async () => {
	const source = await fs.readFile(new URL('./component-store.tsx', import.meta.url), 'utf-8')

	assert.match(
		source,
		/const savedCustom = readCachedList\('custom-components'\)\n\s*if \(savedCustom\) \{\n\s*useCustomComponentStore\.setState\(\{ components: savedCustom \}\)/
	)
	assert.doesNotMatch(source, /Array\.isArray\(parsed\) && parsed\.length > 0/)
})

test('component store ignores corrupted cached lists', async () => {
	const source = await fs.readFile(new URL('./component-store.tsx', import.meta.url), 'utf-8')

	assert.match(source, /function readCachedList\(key: string\): unknown\[\] \| null \{\n\s*try \{\n\s*const saved = localStorage\.getItem\(key\)/)
	assert.match(source, /const parsed = JSON\.parse\(saved\)\n\s*return Array\.isArray\(parsed\) \? parsed : null\n\s*\} catch \{\n\s*return null/)
	assert.match(source, /const savedTemplates = readCachedList\('templates'\)\n\s*if \(savedTemplates\) \{\n\s*useTemplateStore\.setState\(\{ templates: savedTemplates \}\)/)
	assert.match(source, /const savedFavorites = readCachedList\('component-favorites'\)\n\s*if \(savedFavorites\) \{\n\s*useComponentFavoriteStore\.setState\(\{ favorites: savedFavorites \}\)/)
	assert.doesNotMatch(source, /useTemplateStore\.setState\(\{ templates: JSON\.parse\(savedTemplates\) \}\)/)
	assert.doesNotMatch(source, /useComponentFavoriteStore\.setState\(\{ favorites: JSON\.parse\(savedFavorites\) \}\)/)
})
