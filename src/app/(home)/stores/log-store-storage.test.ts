import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('log store guards localStorage access', async () => {
	const source = (await fs.readFile(new URL('./log-store.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	assert.match(source, /function readLocalStorageFlag\(key: string\) \{\n\s*if \(typeof window === 'undefined'\) return false\n\s*try \{\n\s*return localStorage\.getItem\(key\) === 'true'\n\s*\} catch \{\n\s*return false\n\s*\}\n\}/)
	assert.match(source, /function writeLocalStorageFlag\(key: string, value: boolean\) \{\n\s*if \(typeof window === 'undefined'\) return\n\s*try \{\n\s*localStorage\.setItem\(key, String\(value\)\)\n\s*\} catch \{\n\s*return\n\s*\}\n\}/)
	assert.match(source, /enabled: readLocalStorageFlag\('log-enabled'\)/)
	assert.match(source, /visible: readLocalStorageFlag\('log-visible'\)/)
	assert.match(source, /setEnabled: \(enabled\) => \{\n\s*writeLocalStorageFlag\('log-enabled', enabled\)/)
	assert.match(source, /setVisible: \(visible\) => \{\n\s*writeLocalStorageFlag\('log-visible', visible\)/)
})
