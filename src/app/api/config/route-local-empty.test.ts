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

function createConfigRequest(body: unknown) {
	return new Request('http://localhost/api/config', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	}) as any
}

function createMalformedConfigRequest(body: string) {
	return new Request('http://localhost/api/config', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body
	}) as any
}

const { handleConfigPost } = await import('./route-local.ts')

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

	assert.match(source, /writeSiteConfigFileAtomically\(filePath, write\.content\)/)
	assert.match(source, /const touchedConfig: string\[\] = \[\]/)
	assert.match(source, /touchedConfig\.push\(write\.fileName\)/)
	assert.match(source, /const rollbackFailedConfig = await rollbackConfigWrites\(backups\.slice\(0, touchedConfig\.length\)\)/)
	assert.match(source, /configWriteError\.touchedConfigPartial = \[\.\.\.touchedConfig\]/)
	assert.match(source, /configWriteError\.rollbackFailedConfig = rollbackFailedConfig/)
	assert.match(source, /for \(const backup of backups\.reverse\(\)\) \{[\s\S]*await writeSiteConfigFileAtomically\(backup\.filePath, backup\.content\)[\s\S]*rollbackFailedConfig\.push\(path\.basename\(backup\.filePath\)\)/)
	assert.match(source, /isSiteConfigLocalValidationError\(error\) \? \{ error: error\.message \} : buildConfigWriteFailureBody\(error\)/)
	assert.doesNotMatch(source, /function writeFileAtomically/)
	assert.doesNotMatch(source, /await fs\.writeFile\(filePath, write\.content\)/)
	assert.doesNotMatch(source, /writeSiteConfigFileAtomically\(backup\.filePath, backup\.content\)\.catch\(\(\) => undefined\)/)
	assert.doesNotMatch(source, /fs\.rm\(backup\.filePath, \{ force: true \}\)\.catch\(\(\) => undefined\)/)
})

test('local config write preserves layout undo backup when saving card styles', async () => {
	const source = await fs.readFile(new URL('./route-local.ts', import.meta.url), 'utf-8')

	assert.match(source, /function resolveLayoutBackupPath\(\) \{\n\s*return path\.join\(process\.cwd\(\), 'data\/layout\.bak\.json'\)/)
	assert.match(source, /await writeLayoutBackupIfNeeded\(writes, backups\)/)
	assert.match(source, /const layoutBackupPath = resolveLayoutBackupPath\(\)/)
	assert.match(source, /await writeSiteConfigFileAtomically\(layoutBackupPath, cardStylesBackup\.content\)/)
	assert.doesNotMatch(source, /const LAYOUT_BACKUP_PATH = path\.join\(process\.cwd\(\), 'data\/layout\.bak\.json'\)/)
	assert.doesNotMatch(source, /await fs\.writeFile\(layoutBackupPath, cardStylesBackup\.content\)/)
})

test('local config write reports rollback failures after partial config writes', async () => {
	await withTemporaryCwd(async tmpDir => {
		const siteContentPath = path.join(tmpDir, 'src/config/site-content.json')
		const cardStylesPath = path.join(tmpDir, 'src/config/card-styles.json')
		const originalRename = fs.rename
		let siteContentWrites = 0
		const layout100 = {
			musicCard: {
				width: 100,
				height: 100,
				order: 1,
				offsetX: null,
				offsetY: null,
				enabled: true
			}
		}
		const layout120 = {
			musicCard: {
				width: 120,
				height: 100,
				order: 1,
				offsetX: null,
				offsetY: null,
				enabled: true
			}
		}

		await fs.mkdir(path.dirname(siteContentPath), { recursive: true })
		await fs.writeFile(siteContentPath, JSON.stringify({ meta: { title: 'formal' } }, null, '\t'))
		await fs.writeFile(cardStylesPath, JSON.stringify(layout100, null, '\t'))

		fs.rename = (async (...args: Parameters<typeof fs.rename>) => {
			const [, target] = args
			if (target === cardStylesPath) {
				throw new Error('simulated card styles write failure')
			}
			if (target === siteContentPath) {
				siteContentWrites += 1
				if (siteContentWrites > 1) {
					throw new Error('simulated site content rollback failure')
				}
			}
			return originalRename(...args)
		}) as typeof fs.rename

		try {
			const response = await handleConfigPost(
				createConfigRequest({
					siteContent: { meta: { title: 'draft' } },
					cardStyles: layout120
				})
			)
			const payload = await response.json()

			assert.equal(response.status, 500)
			assert.deepEqual(payload, {
				error: '保存站点配置失败',
				touchedConfigPartial: ['site-content.json'],
				details: {
					rollbackFailedConfig: ['site-content.json']
				}
			})
		} finally {
			fs.rename = originalRename
		}
	})
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
	const response = await handleConfigPost(createMalformedConfigRequest('{bad'))

	assert.equal(response.status, 400)
	assert.deepEqual(await response.json(), { error: '请求体格式错误' })
})

test('local config write rejects oversized JSON body before parsing', async () => {
	let jsonCalled = false
	const response = await handleConfigPost({
		headers: new Headers({ 'content-length': String(1024 * 1024 + 1) }),
		json: async () => {
			jsonCalled = true
			throw new Error('json should not be called')
		}
	} as any)

	assert.equal(response.status, 413)
	assert.equal(jsonCalled, false)
	assert.deepEqual(await response.json(), { error: '请求体过大' })
})

test('local config write limits streamed JSON requests without content-length', async () => {
	let pulled = 0
	const encoder = new TextEncoder()
	const response = await handleConfigPost(
		new Request('http://localhost/api/config', {
			method: 'POST',
			body: new ReadableStream({
				pull(controller) {
					pulled += 1
					controller.enqueue(encoder.encode('x'.repeat(256 * 1024)))
				}
			}),
			duplex: 'half'
		} as RequestInit) as any
	)

	assert.equal(response.status, 413)
	assert.equal(pulled <= 6, true)
	assert.deepEqual(await response.json(), { error: '请求体过大' })
})

test('local config write rejects non-object JSON payloads', async () => {
	for (const body of [null, [], 'x']) {
		const response = await handleConfigPost(createConfigRequest(body))

		assert.equal(response.status, 400)
		assert.deepEqual(await response.json(), { error: '请求体格式错误' })
	}
})

test('local config write rejects invalid card styles payloads', async () => {
	for (const cardStyles of [[], {}, { musicCard: { width: 120 } }]) {
		const response = await handleConfigPost(createConfigRequest({ cardStyles }))

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

test('local config write rejects symlinked src config directory', async () => {
	const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'config-route-src-config-symlink-'))
	const outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), 'config-route-src-config-outside-'))
	const previousCwd = process.cwd()
	try {
		await fs.mkdir(path.join(tmpDir, 'src'), { recursive: true })
		await fs.symlink(outsideDir, path.join(tmpDir, 'src/config'), 'dir')
		await fs.writeFile(path.join(outsideDir, 'site-content.json'), JSON.stringify({ meta: { title: 'outside' } }, null, '\t'))
		process.chdir(tmpDir)

		const response = await handleConfigPost(
			new Request('http://localhost/api/config', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ siteContent: { meta: { title: 'draft' } } })
			}) as any
		)

		assert.equal(response.status, 400)
		assert.equal(JSON.parse(await fs.readFile(path.join(outsideDir, 'site-content.json'), 'utf-8')).meta.title, 'outside')
	} finally {
		process.chdir(previousCwd)
		await fs.rm(tmpDir, { recursive: true, force: true })
		await fs.rm(outsideDir, { recursive: true, force: true })
	}
})
test('local config write validates site content local assets inside mutation lock', async () => {
	const source = await fs.readFile(new URL('./route-local.ts', import.meta.url), 'utf-8')
	const lockStart = source.indexOf('await withSiteConfigLocalMutationLock(process.cwd(), async () => {')
	const assetValidation = source.indexOf('await assertSiteConfigDraftLocalAssetsExist(process.cwd(), { siteContent: configPayload.siteContent })')

	assert.notEqual(lockStart, -1)
	assert.notEqual(assetValidation, -1)
	assert.ok(assetValidation > lockStart, 'asset validation must run inside the site-config mutation lock')
})

test('local config write rejects missing site content local assets without touching formal config', async () => {
	await withTemporaryCwd(async tmpDir => {
		const formalPath = path.join(tmpDir, 'src/config/site-content.json')
		const original = { meta: { title: 'formal' } }
		await fs.mkdir(path.dirname(formalPath), { recursive: true })
		await fs.writeFile(formalPath, JSON.stringify(original, null, '\t'))

		const response = await handleConfigPost(
			new Request('http://localhost/api/config', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ siteContent: { artImages: [{ url: '/images/art/missing.png' }] } })
			}) as any
		)

		assert.equal(response.status, 400)
		assert.deepEqual(await response.json(), { error: '草稿引用的本地资源不存在：首页图片 /images/art/missing.png' })
		assert.deepEqual(JSON.parse(await fs.readFile(formalPath, 'utf-8')), original)
	})
})

test('local config write rejects symlinked site content local assets without touching formal config', async () => {
	const outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), 'config-route-asset-outside-'))
	try {
		await withTemporaryCwd(async tmpDir => {
			const formalPath = path.join(tmpDir, 'src/config/site-content.json')
			const assetPath = path.join(tmpDir, 'public/images/art/linked.png')
			const original = { meta: { title: 'formal' } }
			await fs.mkdir(path.dirname(formalPath), { recursive: true })
			await fs.mkdir(path.dirname(assetPath), { recursive: true })
			await fs.writeFile(formalPath, JSON.stringify(original, null, '\t'))
			await fs.writeFile(path.join(outsideDir, 'outside.png'), 'outside')
			await fs.symlink(path.join(outsideDir, 'outside.png'), assetPath)

			const response = await handleConfigPost(
				new Request('http://localhost/api/config', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ siteContent: { artImages: [{ url: '/images/art/linked.png' }] } })
				}) as any
			)

			assert.equal(response.status, 400)
			assert.deepEqual(await response.json(), { error: '草稿引用的本地资源不存在：首页图片 /images/art/linked.png' })
			assert.deepEqual(JSON.parse(await fs.readFile(formalPath, 'utf-8')), original)
		})
	} finally {
		await fs.rm(outsideDir, { recursive: true, force: true })
	}
})

test('local config write rejects symlinked formal config files before reading or writing through them', async () => {
	const outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), 'config-route-formal-outside-'))
	try {
		await withTemporaryCwd(async tmpDir => {
			const configDir = path.join(tmpDir, 'src/config')
			const outsidePath = path.join(outsideDir, 'site-content.json')
			const outsideOriginal = { meta: { title: 'outside' } }
			await fs.mkdir(configDir, { recursive: true })
			await fs.writeFile(outsidePath, JSON.stringify(outsideOriginal, null, '\t'))
			await fs.symlink(outsidePath, path.join(configDir, 'site-content.json'))

			const response = await handleConfigPost(
				new Request('http://localhost/api/config', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ siteContent: { meta: { title: 'draft' } } })
				}) as any
			)

			assert.equal(response.status, 400)
			assert.deepEqual(await response.json(), { error: '站点配置写入路径不合法' })
			assert.deepEqual(JSON.parse(await fs.readFile(outsidePath, 'utf-8')), outsideOriginal)
		})
	} finally {
		await fs.rm(outsideDir, { recursive: true, force: true })
	}
})

test('local config write rejects empty config payloads', async () => {
	const response = await handleConfigPost(createConfigRequest({}))

	assert.equal(response.status, 400)
	assert.deepEqual(await response.json(), { error: '缺少可写配置项' })
})

test('local config write rejects unknown config fields', async () => {
	const response = await handleConfigPost(createConfigRequest({ siteContent: {}, unexpected: true }))

	assert.equal(response.status, 400)
	assert.deepEqual(await response.json(), { error: '请求体包含未知配置项' })
})
