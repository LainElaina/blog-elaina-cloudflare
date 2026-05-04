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

const { POST } = await import('./route.ts')
const { writeSiteConfigDraft } = await import('../../site-config-local-shared.ts')

async function withDevelopmentCwd<T>(callback: (tmpDir: string) => Promise<T>): Promise<T> {
	const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'publish-site-config-route-'))
	const previousNodeEnv = process.env.NODE_ENV
	const previousCwd = process.cwd()
	try {
		process.env.NODE_ENV = 'development'
		process.chdir(tmpDir)
		await fs.mkdir(path.join(tmpDir, 'src/config'), { recursive: true })
		return await callback(tmpDir)
	} finally {
		process.chdir(previousCwd)
		process.env.NODE_ENV = previousNodeEnv
		await fs.rm(tmpDir, { recursive: true, force: true })
	}
}

test('site config publish rejects malformed JSON without publishing saved draft', async () => {
	await withDevelopmentCwd(async tmpDir => {
		const formalPath = path.join(tmpDir, 'src/config/site-content.json')
		await fs.writeFile(formalPath, JSON.stringify({ meta: { title: 'formal' } }, null, '\t'))
		await writeSiteConfigDraft(tmpDir, { siteContent: { meta: { title: 'saved draft' } } })

		const response = await POST(
			new Request('http://localhost/api/publish/site-config', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: '{invalid json'
			})
		)
		const payload = await response.json()

		assert.equal(response.status, 400)
		assert.deepEqual(payload, { error: '请求 JSON 格式错误' })
		assert.equal(JSON.parse(await fs.readFile(formalPath, 'utf-8')).meta.title, 'formal')
		assert.equal((await fs.readFile(path.join(tmpDir, 'data/site-config.draft.json'), 'utf-8')).includes('saved draft'), true)
	})
})

test('site config publish rejects non-object JSON without publishing saved draft', async () => {
	await withDevelopmentCwd(async tmpDir => {
		const formalPath = path.join(tmpDir, 'src/config/site-content.json')
		await fs.writeFile(formalPath, JSON.stringify({ meta: { title: 'formal' } }, null, '\t'))
		await writeSiteConfigDraft(tmpDir, { siteContent: { meta: { title: 'saved draft' } } })

		const response = await POST(
			new Request('http://localhost/api/publish/site-config', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: 'null'
			})
		)
		const payload = await response.json()

		assert.equal(response.status, 400)
		assert.deepEqual(payload, { error: '请求 JSON 格式错误' })
		assert.equal(JSON.parse(await fs.readFile(formalPath, 'utf-8')).meta.title, 'formal')
		assert.equal((await fs.readFile(path.join(tmpDir, 'data/site-config.draft.json'), 'utf-8')).includes('saved draft'), true)
	})
})
