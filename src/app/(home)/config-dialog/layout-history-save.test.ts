import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('layout history snapshots include and restore custom components', async () => {
	const source = await fs.readFile(new URL('./layout-history.tsx', import.meta.url), 'utf-8')

	assert.match(source, /import \{ useCustomComponentStore, type CustomComponent \} from '\.\.\/stores\/custom-component-store'/)
	assert.match(source, /customComponents\?: CustomComponent\[\]/)
	assert.match(source, /const \{ components: customComponents \} = useCustomComponentStore\(\)/)
	assert.match(source, /data: cardStyles,\n\s*customComponents/)
	assert.match(
		source,
		/setCardStyles\(snapshot\.data\)\n\s*if \(Array\.isArray\(snapshot\.customComponents\)\) \{\n\s*useCustomComponentStore\.setState\(\{ components: snapshot\.customComponents \}\)\n\s*localStorage\.setItem\('custom-components', JSON\.stringify\(snapshot\.customComponents\)\)/
	)
	assert.doesNotMatch(source, /if \(snapshot\.customComponents\) \{/)
})

test('layout history ignores corrupted snapshot storage', async () => {
	const source = await fs.readFile(new URL('./layout-history.tsx', import.meta.url), 'utf-8')

	assert.match(source, /function readLayoutSnapshots\(\): LayoutSnapshot\[\] \{\n\s*try \{\n\s*const saved = localStorage\.getItem\('layout-snapshots'\)/)
	assert.match(source, /const parsed = JSON\.parse\(saved\)\n\s*return Array\.isArray\(parsed\) \? parsed : \[\]\n\s*\} catch \{\n\s*return \[\]/)
	assert.match(source, /const loadSnapshots = \(\) => \{\n\s*setSnapshots\(readLayoutSnapshots\(\)\)\n\s*\}/)
	assert.doesNotMatch(source, /setSnapshots\(JSON\.parse\(saved\)\)/)
})
