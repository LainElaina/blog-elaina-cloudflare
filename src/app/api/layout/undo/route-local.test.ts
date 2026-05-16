import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'
import { registerHooks } from 'node:module'
import os from 'node:os'
import path from 'node:path'

registerHooks({
	resolve(specifier, context, nextResolve) {
		if (specifier === 'next/server') {
			return nextResolve('next/server.js', context)
		}
		return nextResolve(specifier, context)
	}
})

const { handleLayoutUndoPost } = await import('./route-local.ts')

test('layout undo local route restores layout atomically through shared site config writes', async () => {
	const source = await fs.readFile(new URL('./route-local.ts', import.meta.url), 'utf-8')

	assert.match(source, /writeSiteConfigFileAtomically\(layoutPath, backup\)/)
	assert.doesNotMatch(source, /function writeFileAtomically/)
	assert.doesNotMatch(source, /fs\.writeFileSync\(layoutPath, backup\)/)
})

test('layout undo local route rejects symlinked src config directory', async () => {
	const previousCwd = process.cwd()
	const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'layout-undo-src-config-symlink-'))
	const outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), 'layout-undo-src-config-outside-'))
	try {
		await fs.mkdir(path.join(tmpDir, 'src'), { recursive: true })
		await fs.mkdir(path.join(tmpDir, 'data'), { recursive: true })
		await fs.symlink(outsideDir, path.join(tmpDir, 'src/config'), 'dir')
		const outsideLayout = { musicCard: { width: 100, height: 100, order: 1, offsetX: null, offsetY: null, enabled: true } }
		const backupLayout = { musicCard: { width: 180, height: 100, order: 1, offsetX: null, offsetY: null, enabled: true } }
		await fs.writeFile(path.join(outsideDir, 'card-styles.json'), JSON.stringify(outsideLayout, null, '\t'))
		await fs.writeFile(path.join(tmpDir, 'data/layout.bak.json'), JSON.stringify(backupLayout, null, '\t'))
		process.chdir(tmpDir)

		const response = await handleLayoutUndoPost()

		assert.equal(response.status, 400)
		assert.deepEqual(JSON.parse(await fs.readFile(path.join(outsideDir, 'card-styles.json'), 'utf-8')), outsideLayout)
	} finally {
		process.chdir(previousCwd)
		await fs.rm(tmpDir, { recursive: true, force: true })
		await fs.rm(outsideDir, { recursive: true, force: true })
	}
})

test('layout undo local route rejects symlinked backup before reading it', async () => {
	const previousCwd = process.cwd()
	const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'layout-undo-backup-symlink-'))
	const outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), 'layout-undo-backup-outside-'))
	try {
		await fs.mkdir(path.join(tmpDir, 'src/config'), { recursive: true })
		await fs.mkdir(path.join(tmpDir, 'data'), { recursive: true })
		const currentLayout = { musicCard: { width: 120, height: 100, order: 1, offsetX: null, offsetY: null, enabled: true } }
		const outsideBackup = { musicCard: { width: 240, height: 100, order: 1, offsetX: null, offsetY: null, enabled: true } }
		await fs.writeFile(path.join(tmpDir, 'src/config/card-styles.json'), JSON.stringify(currentLayout, null, '\t'))
		await fs.writeFile(path.join(outsideDir, 'layout.bak.json'), JSON.stringify(outsideBackup, null, '\t'))
		await fs.symlink(path.join(outsideDir, 'layout.bak.json'), path.join(tmpDir, 'data/layout.bak.json'))
		process.chdir(tmpDir)

		const response = await handleLayoutUndoPost()

		assert.equal(response.status, 400)
		assert.deepEqual(await response.json(), { error: '站点配置写入路径不合法' })
		assert.deepEqual(JSON.parse(await fs.readFile(path.join(tmpDir, 'src/config/card-styles.json'), 'utf-8')), currentLayout)
	} finally {
		process.chdir(previousCwd)
		await fs.rm(tmpDir, { recursive: true, force: true })
		await fs.rm(outsideDir, { recursive: true, force: true })
	}
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


test('layout undo local route reports restore failure context', async () => {
	const previousCwd = process.cwd()
	const previousDateNow = Date.now
	const previousMathRandom = Math.random
	const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'layout-undo-restore-failure-'))
	const backupLayout = { musicCard: { width: 180, height: 100, order: 1, offsetX: null, offsetY: null, enabled: true } }
	const layoutPath = path.join(tmpDir, 'src/config/card-styles.json')
	const backupPath = path.join(tmpDir, 'data/layout.bak.json')
	const tempPath = `${layoutPath}.tmp-${process.pid}-1700000000000-4fzzzxjylrx`

	try {
		await fs.mkdir(path.dirname(layoutPath), { recursive: true })
		await fs.mkdir(path.dirname(backupPath), { recursive: true })
		await fs.writeFile(layoutPath, JSON.stringify({ musicCard: { width: 100, height: 100, order: 1, offsetX: null, offsetY: null, enabled: true } }, null, '	'))
		await fs.writeFile(backupPath, JSON.stringify(backupLayout, null, '	'))
		await fs.writeFile(tempPath, 'occupied', 'utf-8')
		Date.now = () => 1700000000000
		Math.random = () => 0.123456789
		process.chdir(tmpDir)

		const response = await handleLayoutUndoPost()
		const payload = await response.json()

		assert.equal(response.status, 500)
		assert.equal(typeof payload.error, 'string')
		assert.match(payload.error, /^Failed to undo: /)
		assert.match(payload.error, /EEXIST|file already exists/)
		assert.equal(payload.error.includes(tempPath), true)
	} finally {
		process.chdir(previousCwd)
		Date.now = previousDateNow
		Math.random = previousMathRandom
		await fs.rm(tmpDir, { recursive: true, force: true })
	}
})
