import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('custom component store filters invalid persisted entries before hydration', async () => {
	const source = await fs.readFile(new URL('./custom-component-store.ts', import.meta.url), 'utf-8')

	assert.match(source, /export function normalizeCustomComponents\(value: unknown\): CustomComponent\[\] \{\n\s*return Array\.isArray\(value\) \? value\.filter\(isCustomComponent\) : \[\]/)
	assert.match(source, /if \(Array\.isArray\(parsed\)\) return normalizeCustomComponents\(parsed\)/)
	assert.match(source, /return normalizeCustomComponents\(customComponentsDefault\)/)
	assert.doesNotMatch(source, /if \(Array\.isArray\(parsed\)\) return parsed/)
})
