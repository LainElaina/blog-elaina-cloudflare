import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('layout config export ignores corrupted optional caches', async () => {
	const source = await fs.readFile(new URL('./export-layout-button.tsx', import.meta.url), 'utf-8')

	assert.match(source, /function readCachedList\(key: string\): unknown\[\] \{\n\s*try \{\n\s*const saved = localStorage\.getItem\(key\)/)
	assert.match(source, /const parsed = JSON\.parse\(saved\)\n\s*return Array\.isArray\(parsed\) \? parsed : \[\]\n\s*\} catch \{\n\s*return \[\]/)
	assert.match(source, /const customComponents = readCachedList\('custom-components'\)\n\s*const componentFavorites = readCachedList\('component-favorites'\)\n\s*const templates = readCachedList\('templates'\)/)
	assert.doesNotMatch(source, /JSON\.parse\(localStorage\.getItem\('custom-components'\) \|\| '\[\]'\)/)
	assert.doesNotMatch(source, /JSON\.parse\(localStorage\.getItem\('component-favorites'\) \|\| '\[\]'\)/)
	assert.doesNotMatch(source, /JSON\.parse\(localStorage\.getItem\('templates'\) \|\| '\[\]'\)/)
})
