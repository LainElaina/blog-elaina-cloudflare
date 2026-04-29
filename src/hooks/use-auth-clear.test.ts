import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('clearing auth also removes in-memory private key', async () => {
	const source = (await fs.readFile(new URL('./use-auth.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	assert.match(source, /clearAuth: \(\) => \{\n\s*clearAllAuthCache\(\)\n\s*set\(\{ isAuth: false, privateKey: null \}\)\n\s*\}/)
	assert.doesNotMatch(source, /clearAuth: \(\) => \{\n\s*clearAllAuthCache\(\)\n\s*set\(\{ isAuth: false \}\)/)
})
