import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('snippets local save keeps list.json as the same array shape as production publish', async () => {
	const [pageSource, pushSource, listRaw] = await Promise.all([
		fs.readFile(new URL('./page.tsx', import.meta.url), 'utf-8'),
		fs.readFile(new URL('./services/push-snippets.ts', import.meta.url), 'utf-8'),
		fs.readFile(new URL('./list.json', import.meta.url), 'utf-8')
	])

	assert.equal(Array.isArray(JSON.parse(listRaw)), true)
	assert.match(pushSource, /JSON\.stringify\(snippets, null, '\\t'\)/)
	assert.match(pageSource, /content: JSON\.stringify\(snippets, null, '\\t'\)/)
	assert.doesNotMatch(pageSource, /JSON\.stringify\(\{ snippets \}, null, '\\t'\)/)
})
