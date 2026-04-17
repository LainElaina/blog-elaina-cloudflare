import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildLocalShareSaveFilePayloads } from './share-artifacts.ts'
import { buildRemoteShareArtifactContents } from './push-shares.ts'

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
})
