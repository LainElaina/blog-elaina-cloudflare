import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('local config write accepts explicit empty array payloads', async () => {
	const source = await fs.readFile(new URL('./route-local.ts', import.meta.url), 'utf-8')

	assert.match(source, /if \(payload\.customComponents !== undefined\) \{\n\s*writes\.push\(\{ fileName: 'custom-components\.json'/)
	assert.match(source, /if \(payload\.colorPresets !== undefined\) \{\n\s*writes\.push\(\{ fileName: 'color-presets\.json'/)
	assert.doesNotMatch(source, /if \(customComponents\) \{/)
	assert.doesNotMatch(source, /if \(colorPresets\) \{/)
})

test('local config write rolls back earlier files when a later write fails', async () => {
	const source = await fs.readFile(new URL('./route-local.ts', import.meta.url), 'utf-8')

	assert.match(source, /backups\.push\(await readConfigBackup\(filePath\)\)\n\s*await fs\.writeFile\(filePath, write\.content\)/)
	assert.match(source, /catch \(error\) \{\n\s*await rollbackConfigWrites\(backups\)\n\s*throw error\n\s*\}/)
	assert.match(source, /for \(const backup of backups\.reverse\(\)\) \{[\s\S]*await fs\.writeFile\(backup\.filePath, backup\.content\)\.catch\(\(\) => undefined\)[\s\S]*await fs\.rm\(backup\.filePath, \{ force: true \}\)\.catch\(\(\) => undefined\)/)
})

test('local config write preserves layout undo backup when saving card styles', async () => {
	const source = await fs.readFile(new URL('./route-local.ts', import.meta.url), 'utf-8')

	assert.match(source, /const LAYOUT_BACKUP_PATH = path\.join\(process\.cwd\(\), 'data\/layout\.bak\.json'\)/)
	assert.match(source, /await writeLayoutBackupIfNeeded\(writes, backups\)/)
	assert.match(source, /await fs\.writeFile\(LAYOUT_BACKUP_PATH, cardStylesBackup\.content\)/)
})
