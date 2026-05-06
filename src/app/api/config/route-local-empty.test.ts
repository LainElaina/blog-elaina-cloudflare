import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { handleConfigPost } from './route-local.ts'

async function withTemporaryCwd<T>(callback: (tmpDir: string) => Promise<T>): Promise<T> {
	const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'config-route-local-'))
	const previousCwd = process.cwd()
	try {
		process.chdir(tmpDir)
		return await callback(tmpDir)
	} finally {
		process.chdir(previousCwd)
		await fs.rm(tmpDir, { recursive: true, force: true })
	}
}

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

	assert.match(source, /function resolveLayoutBackupPath\(\) \{\n\s*return path\.join\(process\.cwd\(\), 'data\/layout\.bak\.json'\)/)
	assert.match(source, /await writeLayoutBackupIfNeeded\(writes, backups\)/)
	assert.match(source, /const layoutBackupPath = resolveLayoutBackupPath\(\)/)
	assert.match(source, /await writeFileAtomically\(layoutBackupPath, cardStylesBackup\.content\)/)
	assert.doesNotMatch(source, /const LAYOUT_BACKUP_PATH = path\.join\(process\.cwd\(\), 'data\/layout\.bak\.json'\)/)
	assert.doesNotMatch(source, /await fs\.writeFile\(layoutBackupPath, cardStylesBackup\.content\)/)
})

test('local config write creates layout undo backup under current cwd', async () => {
	await withTemporaryCwd(async tmpDir => {
		const cardStylesPath = path.join(tmpDir, 'src/config/card-styles.json')
		const previousCardStyles = {
			musicCard: {
				width: 120,
				height: 100,
				order: 1,
				offsetX: null,
				offsetY: null,
				enabled: true
			}
		}
		const nextCardStyles = {
			musicCard: {
				width: 180,
				height: 100,
				order: 1,
				offsetX: null,
				offsetY: null,
				enabled: true
			}
		}
		await fs.mkdir(path.dirname(cardStylesPath), { recursive: true })
		await fs.writeFile(cardStylesPath, JSON.stringify(previousCardStyles, null, '\t'))

		const response = await handleConfigPost(
			new Request('http://localhost/api/config', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ cardStyles: nextCardStyles })
			}) as any
		)

		assert.equal(response.status, 200)
		assert.deepEqual(JSON.parse(await fs.readFile(path.join(tmpDir, 'data/layout.bak.json'), 'utf-8')), previousCardStyles)
		assert.deepEqual(JSON.parse(await fs.readFile(cardStylesPath, 'utf-8')), nextCardStyles)
	})
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

test('local config write rejects oversized JSON body before parsing', async () => {
	const response = await handleConfigPost(
		new Request('http://localhost/api/config', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Content-Length': String(1024 * 1024 + 1)
			},
			body: '{}'
		}) as any
	)

	assert.equal(response.status, 400)
	assert.deepEqual(await response.json(), { error: '请求体过大' })
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

test('local config write rejects invalid config payload values without touching formal files', async () => {
	for (const { body, targetFile, original, message } of [
		{
			body: { siteContent: [] },
			targetFile: 'site-content.json',
			original: { meta: { title: 'formal' } },
			message: '站点设置配置格式错误'
		},
		{
			body: { customComponents: {} },
			targetFile: 'custom-components.json',
			original: [{ name: 'formal' }],
			message: '自定义组件配置格式错误'
		},
		{
			body: { colorPresets: {} },
			targetFile: 'color-presets.json',
			original: [{ name: 'formal' }],
			message: '色彩预设配置格式错误'
		}
	] as const) {
		await withTemporaryCwd(async tmpDir => {
			const formalPath = path.join(tmpDir, 'src/config', targetFile)
			await fs.mkdir(path.dirname(formalPath), { recursive: true })
			await fs.writeFile(formalPath, JSON.stringify(original, null, '\t'))

			const response = await handleConfigPost(
				new Request('http://localhost/api/config', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(body)
				}) as any
			)

			assert.equal(response.status, 400)
			assert.deepEqual(await response.json(), { error: message })
			assert.deepEqual(JSON.parse(await fs.readFile(formalPath, 'utf-8')), original)
		})
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
