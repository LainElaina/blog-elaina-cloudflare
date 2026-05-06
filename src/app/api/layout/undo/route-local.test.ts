import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { handleLayoutUndoPost } from './route-local.ts'

test('layout undo local route restores layout atomically', async () => {
	const source = await fs.readFile(new URL('./route-local.ts', import.meta.url), 'utf-8')

	assert.match(source, /function buildAtomicLayoutUndoTempPath\(fullPath: string\)/)
	assert.match(source, /function writeFileAtomically\(fullPath: string, content: string\)/)
	assert.match(source, /fs\.writeFileSync\(tempPath, content, 'utf-8'\)\n\t\tfs\.renameSync\(tempPath, fullPath\)/)
	assert.match(source, /fs\.rmSync\(tempPath, \{ force: true \}\)/)
	assert.match(source, /writeFileAtomically\(layoutPath, backup\)/)
	assert.doesNotMatch(source, /fs\.writeFileSync\(layoutPath, backup\)/)
})

test('layout undo local route rejects invalid backup without replacing current layout', async () => {
	const previousCwd = process.cwd()
	const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'layout-undo-invalid-'))
	try {
		await fs.mkdir(path.join(tmpDir, 'src/config'), { recursive: true })
		await fs.mkdir(path.join(tmpDir, 'data'), { recursive: true })
		const currentLayout = '{"artCard":{"width":1,"height":1,"order":1,"offsetX":null,"offsetY":null,"enabled":true}}'
		await fs.writeFile(path.join(tmpDir, 'src/config/card-styles.json'), currentLayout, 'utf-8')
		await fs.writeFile(path.join(tmpDir, 'data/layout.bak.json'), '{"badCard":true}', 'utf-8')
		process.chdir(tmpDir)

		const response = await handleLayoutUndoPost()

		assert.equal(response.status, 400)
		assert.deepEqual(await response.json(), { error: '备份布局配置格式错误' })
		assert.equal(await fs.readFile(path.join(tmpDir, 'src/config/card-styles.json'), 'utf-8'), currentLayout)
	} finally {
		process.chdir(previousCwd)
		await fs.rm(tmpDir, { recursive: true, force: true })
	}
})
