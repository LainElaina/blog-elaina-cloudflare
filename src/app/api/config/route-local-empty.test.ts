import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('local config write accepts explicit empty array payloads', async () => {
	const source = await fs.readFile(new URL('./route-local.ts', import.meta.url), 'utf-8')

	assert.match(source, /if \(customComponents !== undefined\) \{\n\s*await fs\.writeFile\(path\.join\(configDir, 'custom-components\.json'\)/)
	assert.match(source, /if \(colorPresets !== undefined\) \{\n\s*await fs\.writeFile\(path\.join\(configDir, 'color-presets\.json'\)/)
	assert.doesNotMatch(source, /if \(customComponents\) \{/)
	assert.doesNotMatch(source, /if \(colorPresets\) \{/)
})
