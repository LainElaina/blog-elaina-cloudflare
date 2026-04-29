import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('component store hydrates explicit empty cached lists', async () => {
	const source = await fs.readFile(new URL('./component-store.tsx', import.meta.url), 'utf-8')

	assert.match(
		source,
		/const parsed = JSON\.parse\(savedCustom\)\n\s*if \(Array\.isArray\(parsed\)\) \{\n\s*useCustomComponentStore\.setState\(\{ components: parsed \}\)/
	)
	assert.doesNotMatch(source, /Array\.isArray\(parsed\) && parsed\.length > 0/)
})
