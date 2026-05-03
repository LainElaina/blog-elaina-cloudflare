import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import type { LocalSiteAssetUploadBackup } from './push-site-content-local-utils.ts'

const {
	buildLocalConfigPayload,
	buildLocalDraftConfigPayload,
	requestLocalEndpoint,
	getLocalSiteConfigEndpoint,
	shouldSyncFormalAssets,
	shouldRequestLocalConfigEndpoint,
	resolveLocalSocialButtonImageUploadPath,
	shouldClearLocalPendingAssetUploads,
	hasPendingLocalFileAssetUploads,
	rollbackLocalSiteAssetUploads,
	uploadLocalSiteAsset,
	assertCanSaveLocalSiteConfigDraft
} = await import(new URL('./push-site-content-local-utils.ts', import.meta.url).href)
const { writeSiteConfigDraft, readSiteConfigDraft, clearSiteConfigDraft, publishSiteConfigDraft, canPublishSiteConfigDraft, resolveSiteConfigPublishPayload } =
	await import(new URL('../../api/site-config-local-shared.ts', import.meta.url).href)

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

test('buildLocalDraftConfigPayload marks reverted site content for removal', () => {
	const originalSiteContent = { meta: { title: 'A' } }
	const currentSiteContent = { meta: { title: 'A' } }
	const originalCardStyles = { musicCard: { width: 100 } }
	const currentCardStyles = { musicCard: { width: 120 } }

	assert.deepEqual(buildLocalDraftConfigPayload(currentSiteContent, originalSiteContent, currentCardStyles, originalCardStyles), {
		cardStyles: currentCardStyles,
		siteContent: null
	})
})

test('getLocalSiteConfigEndpoint splits draft and publish endpoints', () => {
	assert.equal(getLocalSiteConfigEndpoint('draft'), '/api/drafts/site-config')
	assert.equal(getLocalSiteConfigEndpoint('publish'), '/api/publish/site-config')
})

test('shouldSyncFormalAssets only allows publish action', () => {
	assert.equal(shouldSyncFormalAssets('draft'), false)
	assert.equal(shouldSyncFormalAssets('publish'), true)
})

test('shouldRequestLocalConfigEndpoint includes explicit draft publishes', () => {
	assert.equal(shouldRequestLocalConfigEndpoint('draft', {}, false), false)
	assert.equal(shouldRequestLocalConfigEndpoint('publish', {}, false), false)
	assert.equal(shouldRequestLocalConfigEndpoint('publish', {}, true), true)
	assert.equal(shouldRequestLocalConfigEndpoint('draft', { siteContent: {} }, false), true)
})

test('resolveLocalSocialButtonImageUploadPath uses the configured social button URL', () => {
	const siteContent = {
		socialButtons: [
			{ id: 'github', value: '/images/social-buttons/hash.png' },
			{ id: 'mail', value: 'mailto:hello@example.com' }
		]
	}

	assert.equal(resolveLocalSocialButtonImageUploadPath(siteContent, 'github'), 'public/images/social-buttons/hash.png')
	assert.equal(resolveLocalSocialButtonImageUploadPath(siteContent, 'mail'), null)
	assert.equal(resolveLocalSocialButtonImageUploadPath(siteContent, 'missing'), null)
})

test('shouldClearLocalPendingAssetUploads only clears after local publish', () => {
	assert.equal(shouldClearLocalPendingAssetUploads('draft'), false)
	assert.equal(shouldClearLocalPendingAssetUploads('publish'), true)
})

test('local site config draft rejects pending file assets that are not written to disk', () => {
	const pendingUploads = {
		faviconItem: { type: 'url', url: '/favicon.png' },
		avatarItem: null,
		artImageUploads: { art: { type: 'file' } },
		backgroundImageUploads: {},
		socialButtonImageUploads: {}
	}

	assert.equal(hasPendingLocalFileAssetUploads(pendingUploads), true)
	assert.throws(() => assertCanSaveLocalSiteConfigDraft('draft', pendingUploads), /本地草稿不能包含尚未写入项目的图片文件/)
	assert.doesNotThrow(() => assertCanSaveLocalSiteConfigDraft('publish', pendingUploads))
	assert.equal(hasPendingLocalFileAssetUploads({ artImageUploads: { art: { type: 'url' } } }), false)
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

test('local site asset upload records binary backup before overwriting', async () => {
	const calls: Array<{ input: string; init?: RequestInit }> = []
	const uploadedFiles: LocalSiteAssetUploadBackup[] = []
	const image = new File(['new'], 'new.png', { type: 'image/png' })
	const fetchLocal = async (input: string, init?: RequestInit) => {
		calls.push({ input, init })
		if (input === '/favicon.png') {
			return new Response(new Blob(['old'], { type: 'image/png' }))
		}
		return new Response('{"success":true}')
	}

	await uploadLocalSiteAsset(image, 'public/favicon.png', uploadedFiles, fetchLocal)

	assert.equal(calls[0].input, '/favicon.png')
	assert.equal(calls[1].input, '/api/upload-image')
	assert.equal(uploadedFiles[0].path, 'public/favicon.png')
	assert.equal(uploadedFiles[0].existed, true)
	assert.equal(await uploadedFiles[0].file?.text(), 'old')
})

test('local site asset rollback restores overwritten assets and deletes new uploads', async () => {
	const calls: Array<{ input: string; init?: RequestInit }> = []
	const uploadedFiles: LocalSiteAssetUploadBackup[] = [
		{ path: 'public/favicon.png', existed: true, file: new File(['old icon'], 'favicon.png', { type: 'image/png' }) },
		{ path: 'public/images/art/new.png', existed: false }
	]
	const fetchLocal = async (input: string, init?: RequestInit) => {
		calls.push({ input, init })
		return new Response('{"success":true}')
	}

	await rollbackLocalSiteAssetUploads(uploadedFiles, fetchLocal)

	assert.deepEqual(
		calls.map(call => [call.input, call.init?.method, call.init?.body instanceof FormData ? call.init.body.get('path') : call.init?.body]),
		[
			['/api/delete-image', 'POST', JSON.stringify({ path: 'public/images/art/new.png' })],
			['/api/upload-image', 'POST', 'public/favicon.png']
		]
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

test('保存草稿可清除已回到正式值的站点设置并保留布局草稿', async () => {
	const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'site-config-draft-clear-'))
	const layoutDraft = { musicCard: { width: 120 } }
	try {
		await writeSiteConfigDraft(tmpDir, {
			siteContent: { meta: { title: 'old draft' } },
			cardStyles: layoutDraft
		})

		const draft = await writeSiteConfigDraft(tmpDir, { siteContent: null })

		assert.deepEqual(draft, { cardStyles: layoutDraft })
		assert.deepEqual(await readSiteConfigDraft(tmpDir), { cardStyles: layoutDraft })
	} finally {
		await fs.rm(tmpDir, { recursive: true, force: true })
	}
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

test('正式保存失败时会回滚已写入的正式源并保留草稿', async () => {
	const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'site-config-publish-rollback-'))
	try {
		await fs.mkdir(path.join(tmpDir, 'src/config'), { recursive: true })
		const siteContentPath = path.join(tmpDir, 'src/config/site-content.json')
		const cardStylesPath = path.join(tmpDir, 'src/config/card-styles.json')
		const originalSiteContent = JSON.stringify({ meta: { title: 'formal' } }, null, '\t')
		const draft = {
			siteContent: { meta: { title: 'draft' } },
			cardStyles: { musicCard: { width: 120 } }
		}

		await fs.writeFile(siteContentPath, originalSiteContent)
		await fs.mkdir(cardStylesPath)
		await writeSiteConfigDraft(tmpDir, draft)

		await assert.rejects(() => publishSiteConfigDraft(tmpDir, draft))

		assert.equal(await fs.readFile(siteContentPath, 'utf-8'), originalSiteContent)
		assert.deepEqual(await readSiteConfigDraft(tmpDir), draft)
	} finally {
		await fs.rm(tmpDir, { recursive: true, force: true })
	}
})

test('正式保存前必须先存在草稿', async () => {
	const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'site-config-no-draft-'))
	await fs.mkdir(path.join(tmpDir, 'src/config'), { recursive: true })
	const formalPath = path.join(tmpDir, 'src/config/site-content.json')
	await fs.writeFile(formalPath, JSON.stringify({ meta: { title: 'formal' } }, null, '\t'))

	assert.equal(await canPublishSiteConfigDraft(tmpDir), false)
	await assert.rejects(() => publishSiteConfigDraft(tmpDir, {}), /没有可发布的草稿|draft/i)

	const formalRaw = await fs.readFile(formalPath, 'utf-8')
	assert.equal(JSON.parse(formalRaw).meta.title, 'formal')
	await fs.rm(tmpDir, { recursive: true, force: true })
})

test('正式保存优先使用当前请求 payload 而不是旧草稿', async () => {
	const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'site-config-publish-payload-'))
	await writeSiteConfigDraft(tmpDir, { siteContent: { meta: { title: 'old draft' } } })

	const payload = await resolveSiteConfigPublishPayload(tmpDir, { siteContent: { meta: { title: 'current publish' } } })

	assert.deepEqual(payload, { siteContent: { meta: { title: 'current publish' } } })
	await clearSiteConfigDraft(tmpDir)
	await fs.rm(tmpDir, { recursive: true, force: true })
})

test('正式保存请求为空时回退发布已有草稿', async () => {
	const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'site-config-publish-draft-'))
	const draft = { siteContent: { meta: { title: 'saved draft' } } }
	await writeSiteConfigDraft(tmpDir, draft)

	const payload = await resolveSiteConfigPublishPayload(tmpDir, {})

	assert.deepEqual(payload, draft)
	await clearSiteConfigDraft(tmpDir)
	await fs.rm(tmpDir, { recursive: true, force: true })
})

test('正式保存草稿前会拒绝引用缺失的本地资源', async () => {
	const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'site-config-missing-asset-'))
	await fs.mkdir(path.join(tmpDir, 'src/config'), { recursive: true })
	const formalPath = path.join(tmpDir, 'src/config/site-content.json')
	await fs.writeFile(formalPath, JSON.stringify({ meta: { title: 'formal' } }, null, '\t'))

	const draft = {
		siteContent: {
			meta: { title: 'draft' },
			artImages: [{ id: 'missing', url: '/images/art/missing.png' }]
		}
	}
	await writeSiteConfigDraft(tmpDir, draft)

	await assert.rejects(() => publishSiteConfigDraft(tmpDir, draft), /草稿引用的本地资源不存在/)

	const formalRaw = await fs.readFile(formalPath, 'utf-8')
	assert.equal(JSON.parse(formalRaw).meta.title, 'formal')
	assert.deepEqual(await readSiteConfigDraft(tmpDir), draft)
	await fs.rm(tmpDir, { recursive: true, force: true })
})
