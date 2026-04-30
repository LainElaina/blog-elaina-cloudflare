import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('layout manager sanitizes imported card styles before applying them', async () => {
	const source = await fs.readFile(new URL('./layout-manager.tsx', import.meta.url), 'utf-8')

	assert.match(source, /function sanitizeCardStyles\(value: unknown, currentCardStyles: CardStyles\): CardStyles \| null \{/)
	assert.match(source, /const sanitizedLayout = sanitizeCardStyles\(layout, cardStyles\)/)
	assert.match(source, /if \(!sanitizedLayout\) \{\n\s*toast\.error\('布局配置无效'\)/)
	assert.match(source, /setCardStyles\(sanitizedLayout\)/)
	assert.match(source, /localStorage\.setItem\('custom-layout', JSON\.stringify\(sanitizedLayout\)\)/)
	assert.doesNotMatch(source, /setCardStyles\(layout\)/)
	assert.doesNotMatch(source, /localStorage\.setItem\('custom-layout', importText\)/)
})
