import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('card clears pending reveal timer on cleanup', async () => {
	const source = (await fs.readFile(new URL('./card.tsx', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	assert.match(source, /const timeoutId = window\.setTimeout\(\n\s*\(\) => \{\n\s*setShow\(true\)\n\s*\},\n\s*order \* ANIMATION_DELAY \* 1000\n\s*\)/)
	assert.match(source, /return \(\) => \{\n\s*window\.clearTimeout\(timeoutId\)\n\s*\}/)
	assert.match(source, /\}, \[order, x, y, show\]\)/)
})
