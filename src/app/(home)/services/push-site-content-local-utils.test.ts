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
const {
	writeSiteConfigDraft,
	readSiteConfigDraft,
	clearSiteConfigDraft,
	publishSiteConfigDraft,
	canPublishSiteConfigDraft,
	resolveSiteConfigPublishPayload,
	buildRemovedSiteConfigSocialButtonImagePaths
} = await import(new URL('../../api/site-config-local-shared.ts', import.meta.url).href)

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

test('buildLocalDraftConfigPayload marks reverted card styles for removal', () => {
	const originalSiteContent = { meta: { title: 'A' } }
	const currentSiteContent = { meta: { title: 'B' } }
	const originalCardStyles = { musicCard: { width: 100 } }
	const currentCardStyles = { musicCard: { width: 100 } }

	assert.deepEqual(buildLocalDraftConfigPayload(currentSiteContent, originalSiteContent, currentCardStyles, originalCardStyles), {
		siteContent: currentSiteContent,
		cardStyles: null
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

test('resolveLocalSocialButtonImageUploadPath uses only safe social button filenames', () => {
	const siteContent = {
		socialButtons: [
			{ id: 'github', value: '/images/social-buttons/hash.png' },
			{ id: 'with-query', value: '/images/social-buttons/hash.png?version=1#hash' },
			{ id: 'nested', value: '/images/social-buttons/nested/hash.png' },
			{ id: 'parent', value: '/images/social-buttons/../avatar.png' },
			{ id: 'encoded-parent', value: '/images/social-buttons/..%2Favatar.png' },
			{ id: 'mail', value: 'mailto:hello@example.com' }
		]
	}

	assert.equal(resolveLocalSocialButtonImageUploadPath(siteContent, 'github'), 'public/images/social-buttons/hash.png')
	assert.equal(resolveLocalSocialButtonImageUploadPath(siteContent, 'with-query'), 'public/images/social-buttons/hash.png')
	assert.equal(resolveLocalSocialButtonImageUploadPath(siteContent, 'nested'), null)
	assert.equal(resolveLocalSocialButtonImageUploadPath(siteContent, 'parent'), null)
	assert.equal(resolveLocalSocialButtonImageUploadPath(siteContent, 'encoded-parent'), null)
	assert.equal(resolveLocalSocialButtonImageUploadPath(siteContent, 'mail'), null)
	assert.equal(resolveLocalSocialButtonImageUploadPath(siteContent, 'missing'), null)
})

test('site config social button image deletion only targets unused local images', () => {
	assert.deepEqual(
		buildRemovedSiteConfigSocialButtonImagePaths(
			{
				socialButtons: [
					{ value: '/images/social-buttons/old.png' },
					{ value: '/images/social-buttons/keep.png?version=1' },
					{ value: 'https://cdn.example.com/remote.png' },
					{ value: '/images/social-buttons/../secret.png' }
				]
			},
			{
				socialButtons: [
					{ value: '/images/social-buttons/keep.png' },
					{ value: '/images/social-buttons/new.png' }
				]
			}
		),
		['public/images/social-buttons/old.png']
	)
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

test('local site asset backup read failure aborts before uploading asset', async () => {
	const calls: Array<{ input: string; init?: RequestInit }> = []
	const uploadedFiles: LocalSiteAssetUploadBackup[] = []
	const image = new File(['new'], 'new.png', { type: 'image/png' })
	const fetchLocal = async (input: string, init?: RequestInit) => {
		calls.push({ input, init })
		if (input === '/favicon.png') {
			return new Response('temporary failure', { status: 500 })
		}
		return new Response('{"success":true}')
	}

	await assert.rejects(
		() => uploadLocalSiteAsset(image, 'public/favicon.png', uploadedFiles, fetchLocal),
		/读取 public\/favicon\.png 备份失败/
	)

	assert.deepEqual(uploadedFiles, [])
	assert.deepEqual(calls.map(call => call.input), ['/favicon.png'])
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

test('站点配置草稿和正式发布写入使用原子替换', async () => {
	const source = await fs.readFile(new URL('../../api/site-config-local-shared.ts', import.meta.url), 'utf-8')

	assert.match(source, /function buildAtomicSiteConfigTempPath\(fullPath: string\)/)
	assert.match(source, /async function writeSiteConfigFileAtomically\(fullPath: string, content: string\)/)
	assert.match(source, /await fs\.writeFile\(tempPath, content\)\n\t\tawait fs\.rename\(tempPath, fullPath\)/)
	assert.match(source, /await fs\.rm\(tempPath, \{ force: true \}\)\.catch\(\(\) => undefined\)/)
	assert.match(source, /await writeSiteConfigFileAtomically\(draftPath, JSON\.stringify\(merged, null, '\\t'\)\)/)
	assert.match(source, /await writeSiteConfigFileAtomically\(filePath, write\.content\)/)
	assert.match(source, /await writeSiteConfigFileAtomically\(backup\.filePath, backup\.content\)\.catch\(\(\) => undefined\)/)
	assert.doesNotMatch(source, /await fs\.writeFile\(draftPath, JSON\.stringify\(merged, null, '\\t'\)\)/)
	assert.doesNotMatch(source, /await fs\.writeFile\(filePath, write\.content\)/)
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

test('站点设置草稿保存可清除已回到正式值的布局草稿', async () => {
	const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'site-config-draft-clear-layout-'))
	try {
		await writeSiteConfigDraft(tmpDir, {
			siteContent: { meta: { title: 'old draft' } },
			cardStyles: { musicCard: { width: 120 } }
		})

		const draft = await writeSiteConfigDraft(
			tmpDir,
			buildLocalDraftConfigPayload(
				{ meta: { title: 'new draft' } },
				{ meta: { title: 'formal' } },
				{ musicCard: { width: 100 } },
				{ musicCard: { width: 100 } }
			)
		)

		assert.deepEqual(draft, { siteContent: { meta: { title: 'new draft' } } })
		assert.deepEqual(await readSiteConfigDraft(tmpDir), { siteContent: { meta: { title: 'new draft' } } })
	} finally {
		await fs.rm(tmpDir, { recursive: true, force: true })
	}
})

test('损坏草稿不会在保存时被空对象覆盖', async () => {
	const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'site-config-draft-broken-write-'))
	try {
		const draftPath = path.join(tmpDir, 'data/site-config.draft.json')
		await fs.mkdir(path.dirname(draftPath), { recursive: true })
		await fs.writeFile(draftPath, '{invalid json')

		await assert.rejects(() => writeSiteConfigDraft(tmpDir, { siteContent: { meta: { title: 'draft' } } }), /站点配置草稿解析失败/)
		assert.equal(await fs.readFile(draftPath, 'utf-8'), '{invalid json')
	} finally {
		await fs.rm(tmpDir, { recursive: true, force: true })
	}
})

test('读取与发布损坏草稿会失败而不是当作无草稿', async () => {
	const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'site-config-draft-broken-read-'))
	try {
		const draftPath = path.join(tmpDir, 'data/site-config.draft.json')
		await fs.mkdir(path.dirname(draftPath), { recursive: true })
		await fs.writeFile(draftPath, '{invalid json')

		await assert.rejects(() => readSiteConfigDraft(tmpDir), /站点配置草稿解析失败/)
		await assert.rejects(() => resolveSiteConfigPublishPayload(tmpDir, {}), /站点配置草稿解析失败/)
		assert.equal(await fs.readFile(draftPath, 'utf-8'), '{invalid json')
	} finally {
		await fs.rm(tmpDir, { recursive: true, force: true })
	}
})

test('草稿文件不是对象时会失败而不是继续发布', async () => {
	const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'site-config-draft-invalid-shape-'))
	try {
		const draftPath = path.join(tmpDir, 'data/site-config.draft.json')
		await fs.mkdir(path.dirname(draftPath), { recursive: true })
		await fs.writeFile(draftPath, JSON.stringify([]))

		await assert.rejects(() => readSiteConfigDraft(tmpDir), /站点配置草稿格式错误/)
		await assert.rejects(() => resolveSiteConfigPublishPayload(tmpDir, {}), /站点配置草稿格式错误/)
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

test('正式站点设置损坏时发布草稿会失败并保留草稿', async () => {
	const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'site-config-invalid-formal-'))
	try {
		await fs.mkdir(path.join(tmpDir, 'src/config'), { recursive: true })
		const formalPath = path.join(tmpDir, 'src/config/site-content.json')
		const draft = {
			siteContent: {
				meta: { title: 'draft' },
				socialButtons: []
			}
		}

		await fs.writeFile(formalPath, '{invalid json')
		await writeSiteConfigDraft(tmpDir, draft)

		await assert.rejects(() => publishSiteConfigDraft(tmpDir, draft), /Unexpected token|JSON/)
		assert.equal(await fs.readFile(formalPath, 'utf-8'), '{invalid json')
		assert.deepEqual(await readSiteConfigDraft(tmpDir), draft)
	} finally {
		await fs.rm(tmpDir, { recursive: true, force: true })
	}
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

test('发布站点配置草稿会清理旧社交按钮图片文件', async () => {
	const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'site-config-social-cleanup-'))
	try {
		await fs.mkdir(path.join(tmpDir, 'src/config'), { recursive: true })
		await fs.mkdir(path.join(tmpDir, 'public/images/social-buttons'), { recursive: true })
		await fs.writeFile(
			path.join(tmpDir, 'src/config/site-content.json'),
			JSON.stringify(
				{
					meta: { title: 'formal' },
					socialButtons: [
						{ id: 'old', value: '/images/social-buttons/old.png' },
						{ id: 'keep', value: '/images/social-buttons/keep.png' },
						{ id: 'remote', value: 'https://cdn.example.com/logo.png' }
					]
				},
				null,
				'\t'
			)
		)
		await fs.writeFile(path.join(tmpDir, 'public/images/social-buttons/old.png'), 'old')
		await fs.writeFile(path.join(tmpDir, 'public/images/social-buttons/keep.png'), 'keep')

		const draft = {
			siteContent: {
				meta: { title: 'draft' },
				socialButtons: [{ id: 'keep', value: '/images/social-buttons/keep.png' }]
			}
		}
		await writeSiteConfigDraft(tmpDir, draft)
		await publishSiteConfigDraft(tmpDir, draft)

		await assert.rejects(() => fs.stat(path.join(tmpDir, 'public/images/social-buttons/old.png')), /ENOENT/)
		assert.equal(await fs.readFile(path.join(tmpDir, 'public/images/social-buttons/keep.png'), 'utf-8'), 'keep')
	} finally {
		await fs.rm(tmpDir, { recursive: true, force: true })
	}
})

test('旧社交按钮图片清理失败不会让已发布配置回滚为失败', async () => {
	const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'site-config-social-cleanup-failure-'))
	const originalWarn = console.warn
	const warnings: unknown[][] = []
	console.warn = (...args: unknown[]) => {
		warnings.push(args)
	}
	try {
		await fs.mkdir(path.join(tmpDir, 'src/config'), { recursive: true })
		await fs.mkdir(path.join(tmpDir, 'public/images/social-buttons/old.png'), { recursive: true })
		await fs.writeFile(
			path.join(tmpDir, 'src/config/site-content.json'),
			JSON.stringify(
				{
					meta: { title: 'formal' },
					socialButtons: [{ id: 'old', value: '/images/social-buttons/old.png' }]
				},
				null,
				'\t'
			)
		)

		const draft = {
			siteContent: {
				meta: { title: 'draft' },
				socialButtons: []
			}
		}
		await writeSiteConfigDraft(tmpDir, draft)

		const touched = await publishSiteConfigDraft(tmpDir, draft)
		const formalRaw = await fs.readFile(path.join(tmpDir, 'src/config/site-content.json'), 'utf-8')

		assert.deepEqual(touched, ['site-content.json'])
		assert.equal(JSON.parse(formalRaw).meta.title, 'draft')
		assert.equal(await readSiteConfigDraft(tmpDir), null)
		assert.equal(warnings.length, 1)
		assert.equal(warnings[0]?.[0], '删除旧社交按钮图片失败:')
	} finally {
		console.warn = originalWarn
		await fs.rm(tmpDir, { recursive: true, force: true })
	}
})

test('正式保存请求只有空值字段时不会清除已有草稿', async () => {
	const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'site-config-empty-publish-'))
	const draft = { siteContent: { meta: { title: 'saved draft' } } }
	await writeSiteConfigDraft(tmpDir, draft)

	await assert.rejects(() => publishSiteConfigDraft(tmpDir, { siteContent: null }), /没有可发布的草稿/)

	assert.deepEqual(await readSiteConfigDraft(tmpDir), draft)
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

test('正式保存草稿前会拒绝不安全的本地资源路径', async () => {
	const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'site-config-unsafe-asset-'))
	try {
		await fs.mkdir(path.join(tmpDir, 'src/config'), { recursive: true })
		await fs.mkdir(path.join(tmpDir, 'public/images'), { recursive: true })
		const formalPath = path.join(tmpDir, 'src/config/site-content.json')
		await fs.writeFile(formalPath, JSON.stringify({ meta: { title: 'formal' } }, null, '\t'))
		await fs.writeFile(path.join(tmpDir, 'public/images/secret.png'), 'secret')

		const draft = {
			siteContent: {
				meta: { title: 'draft' },
				artImages: [{ id: 'unsafe', url: '/images/art/../secret.png' }]
			}
		}
		await writeSiteConfigDraft(tmpDir, draft)

		await assert.rejects(() => publishSiteConfigDraft(tmpDir, draft), /草稿引用的本地资源不存在/)
		assert.equal(JSON.parse(await fs.readFile(formalPath, 'utf-8')).meta.title, 'formal')
		assert.deepEqual(await readSiteConfigDraft(tmpDir), draft)
	} finally {
		await fs.rm(tmpDir, { recursive: true, force: true })
	}
})
