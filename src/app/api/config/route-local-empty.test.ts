import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

import { handleConfigPost } from './route-local.ts'

test('local config write accepts explicit empty array payloads', async () => {
	const source = await fs.readFile(new URL('./route-local.ts', import.meta.url), 'utf-8')

	assert.match(source, /if \(payload\.customComponents !== undefined\) \{\n\s*writes\.push\(\{ fileName: 'custom-components\.json'/)
	assert.match(source, /if \(payload\.colorPresets !== undefined\) \{\n\s*writes\.push\(\{ fileName: 'color-presets\.json'/)
	assert.doesNotMatch(source, /if \(customComponents\) \{/)
	assert.doesNotMatch(source, /if \(colorPresets\) \{/)
})

test('local config write rolls back earlier files when a later write fails', async () => {
	const source = await fs.readFile(new URL('./route-local.ts', import.meta.url), 'utf-8')

	assert.match(source, /function buildAtomicConfigTempPath\(fullPath: string\)/)
	assert.match(source, /async function writeFileAtomically\(fullPath: string, content: string\)/)
	assert.match(source, /await fs\.writeFile\(tempPath, content\)\n\t\tawait fs\.rename\(tempPath, fullPath\)/)
	assert.match(source, /backups\.push\(await readConfigBackup\(filePath\)\)\n\s*await writeFileAtomically\(filePath, write\.content\)/)
	assert.match(source, /catch \(error\) \{\n\s*await rollbackConfigWrites\(backups\)\n\s*throw error\n\s*\}/)
	assert.match(source, /for \(const backup of backups\.reverse\(\)\) \{[\s\S]*await writeFileAtomically\(backup\.filePath, backup\.content\)\.catch\(\(\) => undefined\)[\s\S]*await fs\.rm\(backup\.filePath, \{ force: true \}\)\.catch\(\(\) => undefined\)/)
	assert.doesNotMatch(source, /await fs\.writeFile\(filePath, write\.content\)/)
})

test('local config write preserves layout undo backup when saving card styles', async () => {
	const source = await fs.readFile(new URL('./route-local.ts', import.meta.url), 'utf-8')

	assert.match(source, /const LAYOUT_BACKUP_PATH = path\.join\(process\.cwd\(\), 'data\/layout\.bak\.json'\)/)
	assert.match(source, /await writeLayoutBackupIfNeeded\(writes, backups\)/)
	assert.match(source, /await writeFileAtomically\(LAYOUT_BACKUP_PATH, cardStylesBackup\.content\)/)
	assert.doesNotMatch(source, /await fs\.writeFile\(LAYOUT_BACKUP_PATH, cardStylesBackup\.content\)/)
})

test('local config write returns 400 when JSON body is malformed', async () => {
	const response = await handleConfigPost({
		json: async () => {
			throw new SyntaxError('bad json')
		}
	} as any)

	assert.equal(response.status, 400)
	assert.deepEqual(await response.json(), { error: '请求体格式错误' })
})

test('local config write rejects non-object JSON payloads', async () => {
	for (const body of [null, [], 'x']) {
		const response = await handleConfigPost({
			json: async () => body
		} as any)

		assert.equal(response.status, 400)
		assert.deepEqual(await response.json(), { error: '请求体格式错误' })
	}
})

test('local config write rejects invalid card styles payloads', async () => {
	for (const cardStyles of [[], {}, { musicCard: { width: 120 } }]) {
		const response = await handleConfigPost({
			json: async () => ({ cardStyles })
		} as any)

		assert.equal(response.status, 400)
		assert.deepEqual(await response.json(), { error: '卡片布局配置格式错误' })
	}
})

test('local config write rejects empty config payloads', async () => {
	const response = await handleConfigPost({
		json: async () => ({})
	} as any)

	assert.equal(response.status, 400)
	assert.deepEqual(await response.json(), { error: '缺少可写配置项' })
})

test('local config write rejects unknown config fields', async () => {
	const response = await handleConfigPost({
		json: async () => ({ siteContent: {}, unexpected: true })
	} as any)

	assert.equal(response.status, 400)
	assert.deepEqual(await response.json(), { error: '请求体包含未知配置项' })
})
