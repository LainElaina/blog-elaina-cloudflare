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

const { handleLayoutPost } = await import('./route-local.ts')

test('layout local route saves layout and backup atomically', async () => {
	const source = await fs.readFile(new URL('./route-local.ts', import.meta.url), 'utf-8')

	assert.match(source, /function buildAtomicLayoutTempPath\(fullPath: string\)/)
	assert.match(source, /function writeFileAtomically\(fullPath: string, content: string\)/)
	assert.match(source, /fs\.writeFileSync\(tempPath, content, 'utf-8'\)\n\t\tfs\.renameSync\(tempPath, fullPath\)/)
	assert.match(source, /fs\.rmSync\(tempPath, \{ force: true \}\)/)
	assert.match(source, /writeFileAtomically\(backupPath, current\)/)
	assert.match(source, /writeFileAtomically\(layoutPath, JSON\.stringify\(layout, null, '\\t'\)\)/)
	assert.doesNotMatch(source, /fs\.writeFileSync\(backupPath, current\)/)
	assert.doesNotMatch(source, /fs\.writeFileSync\(layoutPath, JSON\.stringify\(layout, null, '\\t'\)\)/)
})

test('layout local route writes current cwd layout instead of module-load cwd', async () => {
	const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'layout-route-local-cwd-'))
	const previousCwd = process.cwd()
	const layout = {
		musicCard: {
			width: 180,
			height: 100,
			order: 1,
			offsetX: null,
			offsetY: null,
			enabled: true
		}
	}

	try {
		await fs.mkdir(path.join(tmpDir, 'src/config'), { recursive: true })
		process.chdir(tmpDir)
		const response = await handleLayoutPost(
			new Request('http://localhost/api/layout', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(layout)
			})
		)

		assert.equal(response.status, 200)
		assert.deepEqual(JSON.parse(await fs.readFile(path.join(tmpDir, 'src/config/card-styles.json'), 'utf-8')), layout)
	} finally {
		process.chdir(previousCwd)
		await fs.rm(tmpDir, { recursive: true, force: true })
	}
})

test('layout local route returns 400 when JSON body is malformed', async () => {
	const response = await handleLayoutPost({
		json: async () => {
			throw new SyntaxError('bad json')
		}
	} as any)

	assert.equal(response.status, 400)
	assert.deepEqual(await response.json(), { error: '请求体格式错误' })
})

test('layout local route returns 400 for oversized request before JSON parsing', async () => {
	let jsonCalled = false
	const response = await handleLayoutPost({
		headers: new Headers({ 'content-length': String(1024 * 1024 + 1) }),
		json: async () => {
			jsonCalled = true
			throw new Error('json should not be called')
		}
	} as any)

	assert.equal(response.status, 400)
	assert.equal(jsonCalled, false)
	assert.deepEqual(await response.json(), { error: '请求体过大' })
})

test('layout local route limits streamed JSON requests without content-length', async () => {
	let pulled = 0
	const encoder = new TextEncoder()
	const response = await handleLayoutPost(
		new Request('http://localhost/api/layout', {
			method: 'POST',
			body: new ReadableStream({
				pull(controller) {
					pulled += 1
					controller.enqueue(encoder.encode('x'.repeat(256 * 1024)))
				}
			}),
			duplex: 'half'
		} as RequestInit)
	)

	assert.equal(response.status, 400)
	assert.equal(pulled <= 6, true)
	assert.deepEqual(await response.json(), { error: '请求体过大' })
})

test('layout local route rejects symlinked src config directory', async () => {
	const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'layout-route-src-config-symlink-'))
	const outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), 'layout-route-src-config-outside-'))
	const previousCwd = process.cwd()
	const layout = {
		musicCard: {
			width: 180,
			height: 100,
			order: 1,
			offsetX: null,
			offsetY: null,
			enabled: true
		}
	}
	try {
		await fs.mkdir(path.join(tmpDir, 'src'), { recursive: true })
		await fs.symlink(outsideDir, path.join(tmpDir, 'src/config'), 'dir')
		await fs.writeFile(path.join(outsideDir, 'card-styles.json'), JSON.stringify({ musicCard: { width: 100, height: 100, order: 1, offsetX: null, offsetY: null, enabled: true } }, null, '\t'))
		process.chdir(tmpDir)

		const response = await handleLayoutPost(
			new Request('http://localhost/api/layout', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(layout)
			})
		)

		assert.equal(response.status, 400)
		assert.equal(JSON.parse(await fs.readFile(path.join(outsideDir, 'card-styles.json'), 'utf-8')).musicCard.width, 100)
	} finally {
		process.chdir(previousCwd)
		await fs.rm(tmpDir, { recursive: true, force: true })
		await fs.rm(outsideDir, { recursive: true, force: true })
	}
})


test('layout local route rejects invalid layout payloads before writing layout', async () => {
	const source = await fs.readFile(new URL('./route-local.ts', import.meta.url), 'utf-8')

	const validationIndex = source.indexOf('if (!isValidLayoutConfig(layout))')
	const backupIndex = source.indexOf('if (fs.existsSync(layoutPath))')
	const writeIndex = source.indexOf("writeFileAtomically(layoutPath, JSON.stringify(layout, null, '\\t'))")

	assert.match(source, /import \{ isValidLayoutConfig \} from '\.\/layout-config-validation\.ts'/)
	assert.match(source, /export \{ isValidLayoutConfig \} from '\.\/layout-config-validation\.ts'/)
	assert.match(source, /if \(!isValidLayoutConfig\(layout\)\) \{\n\s*return NextResponse\.json\(\{ error: '布局配置格式错误' \}, \{ status: 400 \}\)\n\s*\}/)
	assert.ok(validationIndex > 0)
	assert.ok(backupIndex > validationIndex)
	assert.ok(writeIndex > validationIndex)

	for (const payload of [null, [], {}, { badCard: { width: 1, height: 1, order: 1, offsetX: null, offsetY: null, enabled: true } }, { artCard: { width: Number.NaN, height: 1, order: 1, offsetX: null, offsetY: null, enabled: true } }]) {
		const response = await handleLayoutPost({
			json: async () => payload
		} as any)

		assert.equal(response.status, 400)
		assert.deepEqual(await response.json(), { error: '布局配置格式错误' })
	}
})
