import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { registerHooks } from 'node:module'
import { test } from 'node:test'

registerHooks({
	resolve(specifier, context, nextResolve) {
		if (specifier === 'next/server') {
			return nextResolve('next/server.js', context)
		}
		return nextResolve(specifier, context)
	}
})

const { GET, POST } = await import('./route.ts')

async function withDevelopmentCwd<T>(callback: (tmpDir: string) => Promise<T>): Promise<T> {
	const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'draft-site-config-route-'))
	const previousNodeEnv = process.env.NODE_ENV
	const previousCwd = process.cwd()
	try {
		process.env.NODE_ENV = 'development'
		process.chdir(tmpDir)
		return await callback(tmpDir)
	} finally {
		process.chdir(previousCwd)
		process.env.NODE_ENV = previousNodeEnv
		await fs.rm(tmpDir, { recursive: true, force: true })
	}
}

async function assertDraftFileMissing(tmpDir: string) {
	await assert.rejects(
		() => fs.readFile(path.join(tmpDir, 'data/site-config.draft.json'), 'utf-8'),
		(error: NodeJS.ErrnoException) => error.code === 'ENOENT'
	)
}

test('site config draft rejects oversized JSON without writing draft', async () => {
	await withDevelopmentCwd(async tmpDir => {
		const response = await POST(
			new Request('http://localhost/api/drafts/site-config', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Content-Length': String(1024 * 1024 + 1)
				},
				body: '{}'
			})
		)
		const payload = await response.json()

		assert.equal(response.status, 400)
		assert.deepEqual(payload, { error: '请求 JSON 过大' })
		await assertDraftFileMissing(tmpDir)
	})
})

test('site config draft rejects malformed JSON without writing draft', async () => {
	await withDevelopmentCwd(async tmpDir => {
		const response = await POST(
			new Request('http://localhost/api/drafts/site-config', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: '{invalid json'
			})
		)
		const payload = await response.json()

		assert.equal(response.status, 400)
		assert.deepEqual(payload, { error: '请求 JSON 格式错误' })
		await assertDraftFileMissing(tmpDir)
	})
})

test('site config draft rejects non-object JSON without writing draft', async () => {
	for (const body of ['null', '[]']) {
		await withDevelopmentCwd(async tmpDir => {
			const response = await POST(
				new Request('http://localhost/api/drafts/site-config', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body
				})
			)
			const payload = await response.json()

			assert.equal(response.status, 400)
			assert.deepEqual(payload, { error: '请求 JSON 格式错误' })
			await assertDraftFileMissing(tmpDir)
		})
	}
})

test('site config draft ignores unknown keys instead of keeping ghost drafts', async () => {
	await withDevelopmentCwd(async tmpDir => {
		await fs.mkdir(path.join(tmpDir, 'data'), { recursive: true })
		await fs.writeFile(path.join(tmpDir, 'data/site-config.draft.json'), JSON.stringify({ stale: { hidden: true } }, null, '\t'))

		const getResponse = await GET()
		assert.deepEqual(await getResponse.json(), { hasDraft: false, items: [] })

		const response = await POST(
			new Request('http://localhost/api/drafts/site-config', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ stale: { hidden: true } })
			})
		)
		const payload = await response.json()

		assert.equal(response.status, 200)
		assert.deepEqual(payload, { success: true, hasDraft: false, items: [] })
		await assertDraftFileMissing(tmpDir)
	})
})

test('site config draft rejects invalid allowed-key values without writing draft', async () => {
	for (const [body, message] of [
		[{ siteContent: [] }, '站点设置草稿格式错误'],
		[{ cardStyles: [] }, '卡片布局草稿格式错误'],
		[{ cardStyles: { musicCard: { width: 120 } } }, '卡片布局草稿格式错误'],
		[{ customComponents: {} }, '自定义组件草稿格式错误'],
		[{ colorPresets: {} }, '色彩预设草稿格式错误']
	] as const) {
		await withDevelopmentCwd(async tmpDir => {
			const response = await POST(
				new Request('http://localhost/api/drafts/site-config', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(body)
				})
			)
			const payload = await response.json()

			assert.equal(response.status, 400)
			assert.deepEqual(payload, { error: message })
			await assertDraftFileMissing(tmpDir)
		})
	}
})
