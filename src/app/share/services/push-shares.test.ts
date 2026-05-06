import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { describe, it } from 'node:test'

import { buildLocalShareSaveFilePayloads } from './share-artifacts.ts'
import { buildRemoteShareArtifactContents, buildUnusedShareLogoDeleteTreeItems, buildUnusedShareLogoDeleteTreeItemsForStorage } from './push-shares.ts'

describe('buildUnusedShareLogoDeleteTreeItems', () => {
	it('只删除旧列表中不再被当前分享引用的 share 图标文件', () => {
		const previousShares = [
			{
				name: 'Alpha',
				logo: '/images/share/old-alpha.png',
				url: 'https://alpha.dev',
				description: 'alpha',
				tags: ['tool'],
				stars: 4
			},
			{
				name: 'Beta',
				logo: '/images/share/keep-beta.png',
				url: 'https://beta.dev',
				description: 'beta',
				tags: ['tool'],
				stars: 5
			},
			{
				name: 'Remote',
				logo: 'https://cdn.example.com/logo.png',
				url: 'https://remote.dev',
				description: 'remote',
				tags: ['tool'],
				stars: 3
			}
		]
		const currentShares = [
			{
				name: 'Beta',
				logo: '/images/share/keep-beta.png',
				url: 'https://beta.dev',
				description: 'beta',
				tags: ['tool'],
				stars: 5
			},
			{
				name: 'Gamma',
				logo: '/images/share/new-gamma.png',
				url: 'https://gamma.dev',
				description: 'gamma',
				tags: ['tool'],
				stars: 4
			}
		]

		assert.deepEqual(buildUnusedShareLogoDeleteTreeItems(previousShares, currentShares), [
			{
				path: 'public/images/share/old-alpha.png',
				mode: '100644',
				type: 'blob',
				sha: null
			}
		])
	})

	it('按剥离 query/hash 后的 repo 路径比较和删除旧 share 图标', () => {
		assert.deepEqual(
			buildUnusedShareLogoDeleteTreeItems(
				[
					{
						name: 'Old',
						logo: '/images/share/old.png?version=1',
						url: 'https://old.dev',
						description: 'old',
						tags: [],
						stars: 1
					},
					{
						name: 'Keep',
						logo: '/images/share/keep.png?version=1',
						url: 'https://keep.dev',
						description: 'keep',
						tags: [],
						stars: 1
					}
				],
				[
					{
						name: 'Keep',
						logo: '/images/share/keep.png#current',
						url: 'https://keep.dev',
						description: 'keep',
						tags: [],
						stars: 1
					}
				]
			),
			[
				{
					path: 'public/images/share/old.png',
					mode: '100644',
					type: 'blob',
					sha: null
				}
			]
		)
	})

	it('忽略不安全的旧 share 图标路径', () => {
		assert.deepEqual(
			buildUnusedShareLogoDeleteTreeItems(
				[
					{
						name: 'Unsafe',
						logo: '/images/share/../secret.png',
						url: 'https://unsafe.dev',
						description: 'unsafe',
						tags: [],
						stars: 1
					}
				],
				[]
			),
			[]
		)
	})

	it('远端清理旧 share 图标时保留下一版 storage 中仍引用的草稿图标', () => {
		const previousShares = [
			{
				name: 'Draft Logo Published Before',
				logo: '/images/share/draft-logo.png',
				url: 'https://draft-logo.dev',
				description: 'published before',
				tags: [],
				stars: 1
			},
			{
				name: 'Old Logo',
				logo: '/images/share/old-logo.png',
				url: 'https://old-logo.dev',
				description: 'old',
				tags: [],
				stars: 1
			}
		]
		const currentShares = [
			{
				name: 'Current',
				logo: '/images/share/current.png',
				url: 'https://current.dev',
				description: 'current',
				tags: [],
				stars: 1
			}
		]
		const storageRaw = JSON.stringify({
			version: 1,
			updatedAt: '2026-05-05T00:00:00.000Z',
			shares: {
				draft: {
					slug: 'draft',
					name: 'Draft',
					logo: '/images/share/draft-logo.png',
					url: 'https://draft.dev',
					description: 'draft',
					tags: [],
					stars: 1,
					status: 'draft'
				}
			}
		})

		assert.deepEqual(buildUnusedShareLogoDeleteTreeItemsForStorage(previousShares, currentShares, storageRaw), [
			{
				path: 'public/images/share/old-logo.png',
				mode: '100644',
				type: 'blob',
				sha: null
			}
		])
	})
})

describe('buildRemoteShareArtifactContents', () => {
	it('远端发布使用与本地保存一致的四产物契约', async () => {
		const shares = [
			{
				name: 'Alpha',
				logo: '/alpha-next.png',
				url: 'https://alpha-next.dev',
				description: 'alpha next',
				tags: ['tool'],
				stars: 5,
				category: 'tool',
				folderPath: '/alpha/tools'
			}
		]
		const existingStorageRaw = JSON.stringify({
			version: 1,
			updatedAt: '2026-04-07T00:00:00.000Z',
			shares: {
				alpha: {
					slug: 'alpha',
					name: 'Alpha',
					logo: '/alpha.png',
					url: 'https://alpha.dev',
					description: 'alpha',
					tags: ['tool'],
					stars: 4,
					category: 'tool',
					folderPath: '/alpha/tools',
					status: 'published'
				}
			}
		})
		const localPayloads = buildLocalShareSaveFilePayloads(
			shares,
			existingStorageRaw,
			new Map([['https://alpha-next.dev', 'https://alpha.dev']])
		)

		const artifacts = buildRemoteShareArtifactContents({
			shares,
			existingStorageRaw,
			urlMappings: [{ oldUrl: 'https://alpha.dev', currentUrl: 'https://alpha-next.dev' }]
		})

		assert.equal(artifacts.list, localPayloads.find(payload => payload.path === 'public/share/list.json')!.content)
		assert.equal(artifacts.categories, localPayloads.find(payload => payload.path === 'public/share/categories.json')!.content)
		assert.equal(artifacts.folders, localPayloads.find(payload => payload.path === 'public/share/folders.json')!.content)

		const remoteStorage = JSON.parse(artifacts.storage)
		const localStorage = JSON.parse(localPayloads.find(payload => payload.path === 'public/share/storage.json')!.content)
		assert.equal(remoteStorage.version, localStorage.version)
		assert.deepEqual(remoteStorage.shares, localStorage.shares)
		assert.equal(typeof remoteStorage.updatedAt, 'string')
		assert.equal(typeof localStorage.updatedAt, 'string')
		assert.equal(remoteStorage.updatedAt.length > 0, true)
		assert.equal(localStorage.updatedAt.length > 0, true)
	})

	it('远端发布保留当前 UI 列表未感知的既有 published 记录', () => {
		const artifacts = buildRemoteShareArtifactContents({
			shares: [
				{
					name: 'Current',
					logo: '/current.png',
					url: 'https://current.dev',
					description: 'current',
					tags: ['tool'],
					stars: 5
				}
			],
			existingStorageRaw: JSON.stringify({
				version: 1,
				updatedAt: '2026-04-07T00:00:00.000Z',
				shares: {
					current: {
						slug: 'current',
						name: 'Current',
						logo: '/current-old.png',
						url: 'https://current.dev',
						description: 'current old',
						tags: ['tool'],
						stars: 4,
						status: 'published'
					},
					unseen: {
						slug: 'unseen',
						name: 'Unseen',
						logo: '/unseen.png',
						url: 'https://unseen.dev',
						description: 'unseen',
						tags: ['design'],
						stars: 3,
						status: 'published'
					}
				}
			})
		})

		const storage = JSON.parse(artifacts.storage)
		const list = JSON.parse(artifacts.list)
		assert.equal(storage.shares.unseen.url, 'https://unseen.dev')
		assert.deepEqual(
			list.map((share: { url: string }) => share.url).sort(),
			['https://current.dev', 'https://unseen.dev']
		)
	})

	it('远端发布遇到 URL 冲突时也会按本地契约失败', async () => {
		assert.throws(
			() =>
				buildRemoteShareArtifactContents({
					shares: [
						{
							name: 'Alpha',
							logo: '/alpha.png',
							url: 'https://alpha.dev',
							description: 'alpha',
							tags: ['tool'],
							stars: 4
						},
						{
							name: 'Alpha Clone',
							logo: '/alpha-next.png',
							url: 'https://alpha.dev',
							description: 'alpha next',
							tags: ['tool'],
							stars: 5
						}
					],
					existingStorageRaw: JSON.stringify({
						version: 1,
						updatedAt: '2026-04-07T00:00:00.000Z',
						shares: {
							alpha: {
								slug: 'alpha',
								name: 'Alpha',
								logo: '/alpha.png',
								url: 'https://alpha.dev',
								description: 'alpha',
								tags: ['tool'],
								stars: 4,
								status: 'published'
							}
						}
					}),
					urlMappings: []
				}),
			/URL 已存在/
		)
	})

	it('远端发布也会拒绝删除后复用已删除的 published URL', () => {
		assert.throws(
			() =>
				buildRemoteShareArtifactContents({
					shares: [
						{
							name: 'Beta',
							logo: '/beta-next.png',
							url: 'https://alpha.dev',
							description: 'beta next',
							tags: ['design'],
							stars: 5
						}
					],
					existingStorageRaw: JSON.stringify({
						version: 1,
						updatedAt: '2026-04-07T00:00:00.000Z',
						shares: {
							alpha: {
								slug: 'alpha',
								name: 'Alpha',
								logo: '/alpha.png',
								url: 'https://alpha.dev',
								description: 'alpha',
								tags: ['tool'],
								stars: 4,
								status: 'published'
							},
							beta: {
								slug: 'beta',
								name: 'Beta',
								logo: '/beta.png',
								url: 'https://beta.dev',
								description: 'beta',
								tags: ['design'],
								stars: 4,
								status: 'published'
							}
						}
					}),
					urlMappings: [],
					deletedPublishedUrls: new Set(['https://alpha.dev'])
				}),
			/URL 已存在/
		)
	})

	it('pushShares 入口会把 deletedPublishedUrls 继续传给远端产物 builder', async () => {
		const source = await fs.readFile(new URL('./push-shares.ts', import.meta.url), 'utf-8')

		assert.match(source, /deletedPublishedUrls\?: Set<string>/)
		assert.match(source, /const \{ shares, logoItems, urlMappings, deletedPublishedUrls \} = params/)
		assert.match(source, /buildRemoteShareArtifactContents\(\{[\s\S]*deletedPublishedUrls[\s\S]*\}\)/)
	})

	it('pushShares 图标上传按文件名去重，避免同 hash 不同扩展名混用', async () => {
		const source = await fs.readFile(new URL('./push-shares.ts', import.meta.url), 'utf-8')

		assert.match(source, /const uploadedLogoPaths = new Map<string, string>\(\)/)
		assert.match(source, /const publicPath = `\/images\/share\/\$\{filename\}`\n\s*const uploadKey = filename/)
		assert.match(source, /if \(!uploadedLogoPaths\.has\(uploadKey\)\) \{[\s\S]*?uploadedLogoPaths\.set\(uploadKey, publicPath\)[\s\S]*?\}/)
		assert.match(source, /nextLogoPaths\.set\(url, uploadedLogoPaths\.get\(uploadKey\)!\)/)
		assert.doesNotMatch(source, /uploadedLogoPaths\.has\(hash\)/)
		assert.doesNotMatch(source, /uploadedLogoPaths\.set\(hash, publicPath\)/)
	})

	it('pushShares 入口会从基线 list.json 计算旧 share 图标删除项', async () => {
		const source = await fs.readFile(new URL('./push-shares.ts', import.meta.url), 'utf-8')

		assert.match(source, /readTextFileFromRepo\([^\n]*'public\/share\/list\.json', latestCommitSha\)/)
		assert.match(source, /const previousShares = parsePreviousShareList\(previousListJson\)/)
		assert.match(source, /treeItems\.push\(\.\.\.buildUnusedShareLogoDeleteTreeItemsForStorage\(previousShares, updatedShares, artifactContents\.storage\)\)/)
		assert.match(source, /远程分享列表解析失败/)
	})
})
