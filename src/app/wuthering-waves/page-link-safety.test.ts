import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('wuthering waves external tool link does not expose window opener', async () => {
	const source = await fs.readFile(new URL('./page.tsx', import.meta.url), 'utf-8')

	assert.match(
		source,
		/<a href='https:\/\/mc\.kurogames\.com\/cloud\/#\/tools' target='_blank' rel='noopener noreferrer'/
	)
})
