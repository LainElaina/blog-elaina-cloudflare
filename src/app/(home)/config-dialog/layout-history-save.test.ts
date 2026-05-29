import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('layout history snapshots include and restore custom components', async () => {
	const source = await fs.readFile(new URL('./layout-history.tsx', import.meta.url), 'utf-8')

	assert.match(source, /import customComponentsDefault from '@\/config\/custom-components\.json'/)
	assert.match(source, /import \{ mergeCustomComponentsWithDefaults, useCustomComponentStore, type CustomComponent \} from '\.\.\/stores\/custom-component-store'/)
	assert.match(source, /customComponents\?: CustomComponent\[\]/)
	assert.match(source, /const \{ components: customComponents \} = useCustomComponentStore\(\)/)
	assert.match(source, /data: cardStyles,\n\s*customComponents/)
	assert.match(
		source,
		/setCardStyles\(snapshot\.data\)\n\s*if \(Array\.isArray\(snapshot\.customComponents\)\) \{\n\s*const components = mergeCustomComponentsWithDefaults\(snapshot\.customComponents, customComponentsDefault\)\n\s*useCustomComponentStore\.setState\(\{ components \}\)\n\s*localStorage\.setItem\('custom-components', JSON\.stringify\(components\)\)/
	)
	assert.doesNotMatch(source, /if \(snapshot\.customComponents\) \{/)
})

test('layout history ignores corrupted snapshot storage', async () => {
	const source = await fs.readFile(new URL('./layout-history.tsx', import.meta.url), 'utf-8')

	assert.match(source, /function normalizeLayoutSnapshots\(value: unknown\): LayoutSnapshot\[\] \{\n\s*if \(!Array\.isArray\(value\)\) return \[\]/)
	assert.match(source, /function readLayoutSnapshots\(\): LayoutSnapshot\[\] \{\n\s*try \{\n\s*const saved = localStorage\.getItem\('layout-snapshots'\)/)
	assert.match(source, /return normalizeLayoutSnapshots\(JSON\.parse\(saved\)\)\n\s*\} catch \{\n\s*return \[\]/)
	assert.match(source, /const loadSnapshots = \(\) => \{\n\s*setSnapshots\(readLayoutSnapshots\(\)\)\n\s*\}/)
	assert.doesNotMatch(source, /setSnapshots\(JSON\.parse\(saved\)\)/)
})
