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
const { readSiteConfigDraft, writeSiteConfigDraft } = await import('../../site-config-local-shared.ts')

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

test('site config publish rejects oversized JSON before parsing without publishing saved draft', async () => {
	await withDevelopmentCwd(async tmpDir => {
		const formalPath = path.join(tmpDir, 'src/config/site-content.json')
		await fs.writeFile(formalPath, JSON.stringify({ meta: { title: 'formal' } }, null, '\t'))
		await writeSiteConfigDraft(tmpDir, { siteContent: { meta: { title: 'saved draft' } } })

		let jsonCalled = false
		const response = await POST({
			headers: new Headers({ 'content-length': String(1024 * 1024 + 1) }),
			json: async () => {
				jsonCalled = true
				throw new Error('json should not be called')
			}
		} as any)
		const payload = await response.json()

		assert.equal(response.status, 400)
		assert.equal(jsonCalled, false)
		assert.deepEqual(payload, { error: '请求 JSON 过大' })
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

test('site config publish rejects unknown request keys without publishing saved draft', async () => {
	await withDevelopmentCwd(async tmpDir => {
		const formalPath = path.join(tmpDir, 'src/config/site-content.json')
		await fs.writeFile(formalPath, JSON.stringify({ meta: { title: 'formal' } }, null, '\t'))
		await writeSiteConfigDraft(tmpDir, { siteContent: { meta: { title: 'saved draft' } } })

		const response = await POST(
			new Request('http://localhost/api/publish/site-config', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ typoSiteContent: { meta: { title: 'should not publish' } } })
			})
		)
		const payload = await response.json()

		assert.equal(response.status, 400)
		assert.deepEqual(payload, { error: '站点配置发布请求包含不支持的字段：typoSiteContent' })
		assert.equal(JSON.parse(await fs.readFile(formalPath, 'utf-8')).meta.title, 'formal')
		assert.equal((await fs.readFile(path.join(tmpDir, 'data/site-config.draft.json'), 'utf-8')).includes('saved draft'), true)
	})
})

test('site config publish returns 400 when there is no draft payload', async () => {
	await withDevelopmentCwd(async tmpDir => {
		const formalPath = path.join(tmpDir, 'src/config/site-content.json')
		await fs.writeFile(formalPath, JSON.stringify({ meta: { title: 'formal' } }, null, '\t'))

		const response = await POST(
			new Request('http://localhost/api/publish/site-config', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({})
			})
		)
		const payload = await response.json()

		assert.equal(response.status, 400)
		assert.deepEqual(payload, { error: '没有可发布的草稿' })
		assert.equal(JSON.parse(await fs.readFile(formalPath, 'utf-8')).meta.title, 'formal')
	})
})

test('site config publish returns 400 when draft references missing local assets', async () => {
	await withDevelopmentCwd(async tmpDir => {
		const formalPath = path.join(tmpDir, 'src/config/site-content.json')
		await fs.writeFile(formalPath, JSON.stringify({ meta: { title: 'formal' } }, null, '\t'))

		const response = await POST(
			new Request('http://localhost/api/publish/site-config', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					siteContent: {
						artImages: [{ url: '/images/art/missing.png' }]
					}
				})
			})
		)
		const payload = await response.json()

		assert.equal(response.status, 400)
		assert.deepEqual(payload, { error: '草稿引用的本地资源不存在：首页图片 /images/art/missing.png' })
		assert.equal(JSON.parse(await fs.readFile(formalPath, 'utf-8')).meta.title, 'formal')
	})
})

test('site config publish rejects invalid request payload values without touching formal config', async () => {
	for (const [body, message] of [
		[{ siteContent: [] }, '站点设置草稿格式错误'],
		[{ cardStyles: [] }, '卡片布局草稿格式错误'],
		[{ cardStyles: { musicCard: { width: 120 } } }, '卡片布局草稿格式错误'],
		[{ customComponents: {} }, '自定义组件草稿格式错误'],
		[{ colorPresets: {} }, '色彩预设草稿格式错误']
	] as const) {
		await withDevelopmentCwd(async tmpDir => {
			const formalPath = path.join(tmpDir, 'src/config/site-content.json')
			await fs.writeFile(formalPath, JSON.stringify({ meta: { title: 'formal' } }, null, '\t'))

			const response = await POST(
				new Request('http://localhost/api/publish/site-config', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(body)
				})
			)
			const payload = await response.json()

			assert.equal(response.status, 400)
			assert.deepEqual(payload, { error: message })
			assert.equal(JSON.parse(await fs.readFile(formalPath, 'utf-8')).meta.title, 'formal')
		})
	}
})

test('site config publish rejects malformed saved draft without touching formal config', async () => {
	await withDevelopmentCwd(async tmpDir => {
		const formalPath = path.join(tmpDir, 'src/config/site-content.json')
		const draftPath = path.join(tmpDir, 'data/site-config.draft.json')
		await fs.writeFile(formalPath, JSON.stringify({ meta: { title: 'formal' } }, null, '\t'))
		await fs.mkdir(path.dirname(draftPath), { recursive: true })
		await fs.writeFile(draftPath, '{invalid json')

		const response = await POST(
			new Request('http://localhost/api/publish/site-config', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ siteContent: { meta: { title: 'current publish' } } })
			})
		)
		const payload = await response.json()

		assert.equal(response.status, 400)
		assert.deepEqual(payload, { error: '站点配置草稿解析失败，请修复 data/site-config.draft.json 后重试' })
		assert.equal(JSON.parse(await fs.readFile(formalPath, 'utf-8')).meta.title, 'formal')
		assert.equal(await fs.readFile(draftPath, 'utf-8'), '{invalid json')
	})
})

test('site config publish rejects invalid saved draft values without touching formal config', async () => {
	await withDevelopmentCwd(async tmpDir => {
		const formalPath = path.join(tmpDir, 'src/config/custom-components.json')
		await fs.writeFile(formalPath, JSON.stringify([{ name: 'formal' }], null, '\t'))
		await fs.mkdir(path.join(tmpDir, 'data'), { recursive: true })
		await fs.writeFile(path.join(tmpDir, 'data/site-config.draft.json'), JSON.stringify({ customComponents: {} }, null, '\t'))

		const response = await POST(
			new Request('http://localhost/api/publish/site-config', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({})
			})
		)
		const payload = await response.json()

		assert.equal(response.status, 400)
		assert.deepEqual(payload, { error: '自定义组件草稿格式错误' })
		assert.deepEqual(JSON.parse(await fs.readFile(formalPath, 'utf-8')), [{ name: 'formal' }])
	})
})

test('site config publish keeps unrelated saved draft keys after explicit partial publish', async () => {
	await withDevelopmentCwd(async tmpDir => {
		await fs.writeFile(path.join(tmpDir, 'src/config/site-content.json'), JSON.stringify({ meta: { title: 'formal' } }, null, '\t'))
		await writeSiteConfigDraft(tmpDir, {
			siteContent: { meta: { title: 'saved draft' } },
			colorPresets: [{ name: 'saved colors' }]
		})

		const response = await POST(
			new Request('http://localhost/api/publish/site-config', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ siteContent: { meta: { title: 'current publish' } } })
			})
		)
		const payload = await response.json()
		const saved = JSON.parse(await fs.readFile(path.join(tmpDir, 'src/config/site-content.json'), 'utf-8'))

		assert.equal(response.status, 200)
		assert.deepEqual(payload.touchedFormal, ['site-content.json'])
		assert.equal(saved.meta.title, 'current publish')
		assert.equal(payload.clearedDraft, 'data/site-config.draft.json')
		assert.equal(JSON.stringify(payload).includes(tmpDir), false)
		assert.deepEqual(await readSiteConfigDraft(tmpDir), { colorPresets: [{ name: 'saved colors' }] })
	})
})

test('site config publish accepts object-shaped local asset collections', async () => {
	await withDevelopmentCwd(async tmpDir => {
		await fs.mkdir(path.join(tmpDir, 'public/images/art'), { recursive: true })
		await fs.mkdir(path.join(tmpDir, 'public/images/background'), { recursive: true })
		await fs.mkdir(path.join(tmpDir, 'public/images/social-buttons'), { recursive: true })
		await fs.writeFile(path.join(tmpDir, 'public/images/art/hero.png'), 'hero')
		await fs.writeFile(path.join(tmpDir, 'public/images/background/bg.png'), 'bg')
		await fs.writeFile(path.join(tmpDir, 'public/images/social-buttons/github.png'), 'github')

		const response = await POST(
			new Request('http://localhost/api/publish/site-config', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					siteContent: {
						artImages: {
							hero: { url: '/images/art/hero.png' }
						},
						backgroundImages: {
							main: { url: '/images/background/bg.png' }
						},
						socialButtons: {
							github: { value: '/images/social-buttons/github.png' }
						}
					}
				})
			})
		)
		const payload = await response.json()
		const saved = JSON.parse(await fs.readFile(path.join(tmpDir, 'src/config/site-content.json'), 'utf-8'))

		assert.equal(response.status, 200)
		assert.deepEqual(payload.touchedFormal, ['site-content.json'])
		assert.equal(saved.artImages.hero.url, '/images/art/hero.png')
		assert.equal(saved.backgroundImages.main.url, '/images/background/bg.png')
		assert.equal(saved.socialButtons.github.value, '/images/social-buttons/github.png')
	})
})
