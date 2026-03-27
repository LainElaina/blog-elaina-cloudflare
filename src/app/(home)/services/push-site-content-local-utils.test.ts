import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const { buildLocalConfigPayload, requestLocalEndpoint, getLocalSiteConfigEndpoint } = await import(new URL('./push-site-content-local-utils.ts', import.meta.url).href)
const { writeSiteConfigDraft, readSiteConfigDraft, clearSiteConfigDraft, publishSiteConfigDraft } = await import(new URL('../../api/site-config-local-shared.ts', import.meta.url).href)

test('buildLocalConfigPayload only includes changed site content', () => {
	const originalSiteContent = { meta: { title: 'A' }, theme: { colorBrand: '#000' } }
	const currentSiteContent = { meta: { title: 'B' }, theme: { colorBrand: '#000' } }
	const originalCardStyles = { musicCard: { width: 100 } }
	const currentCardStyles = { musicCard: { width: 100 } }

	assert.deepEqual(buildLocalConfigPayload(currentSiteContent, originalSiteContent, currentCardStyles, originalCardStyles), {
		siteContent: currentSiteContent
	})
})

test('buildLocalConfigPayload only includes changed card styles', () => {
	const originalSiteContent = { meta: { title: 'A' } }
	const currentSiteContent = { meta: { title: 'A' } }
	const originalCardStyles = { musicCard: { width: 100 } }
	const currentCardStyles = { musicCard: { width: 120 } }

	assert.deepEqual(buildLocalConfigPayload(currentSiteContent, originalSiteContent, currentCardStyles, originalCardStyles), {
		cardStyles: currentCardStyles
	})
})

test('getLocalSiteConfigEndpoint splits draft and publish endpoints', () => {
	assert.equal(getLocalSiteConfigEndpoint('draft'), '/api/drafts/site-config')
	assert.equal(getLocalSiteConfigEndpoint('publish'), '/api/publish/site-config')
})

test('requestLocalEndpoint throws server error message for non-ok response', async () => {
	await assert.rejects(
		requestLocalEndpoint(
			async () =>
				new Response(JSON.stringify({ error: '写入失败' }), {
					status: 500,
					headers: { 'Content-Type': 'application/json' }
				}),
			'/api/config'
		),
		/写入失败/
	)
})

test('requestLocalEndpoint aborts hung request with timeout message', async () => {
	await assert.rejects(
		requestLocalEndpoint(
			(input: RequestInfo | URL, init?: RequestInit) =>
				new Promise((_resolve, reject) => {
					init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
				}),
			'/api/config',
			undefined,
			5
		),
		/本地保存超时/
	)
})

test('保存草稿不直接触碰正式源', async () => {
	const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'site-config-draft-'))
	await fs.mkdir(path.join(tmpDir, 'src/config'), { recursive: true })
	const formalPath = path.join(tmpDir, 'src/config/site-content.json')
	await fs.writeFile(formalPath, JSON.stringify({ meta: { title: 'formal' } }, null, '\t'))

	await writeSiteConfigDraft(tmpDir, { siteContent: { meta: { title: 'draft' } } })
	const formalRaw = await fs.readFile(formalPath, 'utf-8')
	assert.equal(JSON.parse(formalRaw).meta.title, 'formal')

	await clearSiteConfigDraft(tmpDir)
	await fs.rm(tmpDir, { recursive: true, force: true })
})

test('正式保存会写正式源并清理草稿', async () => {
	const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'site-config-publish-'))
	await fs.mkdir(path.join(tmpDir, 'src/config'), { recursive: true })
	const formalPath = path.join(tmpDir, 'src/config/site-content.json')
	await fs.writeFile(formalPath, JSON.stringify({ meta: { title: 'formal' } }, null, '\t'))

	await writeSiteConfigDraft(tmpDir, { siteContent: { meta: { title: 'draft' } } })
	const touched = await publishSiteConfigDraft(tmpDir, (await readSiteConfigDraft(tmpDir)) ?? {})

	const formalRaw = await fs.readFile(formalPath, 'utf-8')
	assert.equal(JSON.parse(formalRaw).meta.title, 'draft')
	assert.ok(touched.includes('site-content.json'))
	assert.equal(await readSiteConfigDraft(tmpDir), null)

	await fs.rm(tmpDir, { recursive: true, force: true })
})

test('正式保存超时/失败会正确暴露', async () => {
	await assert.rejects(
		requestLocalEndpoint(
			(_input: RequestInfo | URL, init?: RequestInit) =>
				new Promise((_resolve, reject) => {
					init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
				}),
			'/api/publish/site-config',
			undefined,
			5
		),
		/本地保存超时: \/api\/publish\/site-config/
	)
})
