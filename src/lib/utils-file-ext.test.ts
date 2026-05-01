import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('getFileExt preserves allowed image extensions used by upload endpoints', async () => {
	const source = (await fs.readFile(new URL('./utils.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	for (const ext of ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico', 'avif']) {
		assert.match(source, new RegExp(`if \\(lower\\.endsWith\\('\\.${ext}'\\)\\) return '\\.${ext}'`), ext)
	}
	assert.match(source, /return '\.png'/)
})
