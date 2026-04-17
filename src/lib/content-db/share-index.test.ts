import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildShareStorageFromList, exportStaticShareArtifacts, parseShareStorageDB } from './share-storage.ts'
import { applyShareLogoPathUpdates, buildLocalShareSaveFilePayloads } from '../../app/share/services/share-artifacts.ts'

function createStorageRaw(shares: Record<string, Record<string, unknown>>) {
	return JSON.stringify({
		version: 1,
		updatedAt: '2026-04-07T00:00:00.000Z',
		shares
	})
}

describe('share storage model', () => {
	it('支持大列表并导出分类与目录索引', () => {
		const input = Array.from({ length: 40 }, (_, index) => ({
			name: `Item ${index}`,
			logo: `/logos/${index}.png`,
			url: `https://example.com/${index}`,
			description: `desc ${index}`,
			tags: index % 2 === 0 ? ['tool'] : ['design'],
			stars: (index % 5) + 1,
			category: index % 2 === 0 ? 'tool' : 'design',
			folderPath: index % 2 === 0 ? '/alpha/tools' : '/beta/inspiration'
		}))

		const db = buildShareStorageFromList(input, new Date('2026-04-07T00:00:00.000Z'))
		const artifacts = exportStaticShareArtifacts(db)

		assert.equal(artifacts.list.length, 40)
		assert.deepEqual(artifacts.categories, ['design', 'tool'])
		assert.deepEqual(artifacts.folders, [
			{
				name: 'alpha',
				path: '/alpha',
				children: [{ name: 'tools', path: '/alpha/tools', children: [] }]
			},
			{
				name: 'beta',
				path: '/beta',
				children: [{ name: 'inspiration', path: '/beta/inspiration', children: [] }]
			}
		])
		assert.deepEqual(artifacts.list[0], {
			name: 'Item 0',
			logo: '/logos/0.png',
			url: 'https://example.com/0',
			description: 'desc 0',
			tags: ['tool'],
			stars: 1,
			category: 'tool',
			folderPath: '/alpha/tools'
		})
	})

	it('上传 logo 后会只替换对应 share 的 logo 路径并保留其他字段', () => {
		const updated = applyShareLogoPathUpdates(
			[
				{
					name: 'Alpha',
					logo: 'https://alpha.dev/logo.png',
					url: 'https://alpha.dev',
					description: 'alpha',
					tags: ['tool'],
					stars: 4,
					category: 'tool',
					folderPath: '/alpha/tools'
				},
				{
					name: 'Beta',
					logo: 'https://beta.dev/logo.png',
					url: 'https://beta.dev',
					description: 'beta',
					tags: ['design'],
					stars: 5,
					category: 'design',
					folderPath: '/beta/inspiration'
				}
			],
			new Map([['https://alpha.dev', '/images/share/alpha.png']])
		)

		assert.deepEqual(updated, [
			{
				name: 'Alpha',
				logo: '/images/share/alpha.png',
				url: 'https://alpha.dev',
				description: 'alpha',
				tags: ['tool'],
				stars: 4,
				category: 'tool',
				folderPath: '/alpha/tools'
			},
			{
				name: 'Beta',
				logo: 'https://beta.dev/logo.png',
				url: 'https://beta.dev',
				description: 'beta',
				tags: ['design'],
				stars: 5,
				category: 'design',
				folderPath: '/beta/inspiration'
			}
		])
	})

	it('基于既有 storage 保存时会保留非 published 记录与未暴露字段', () => {
		const payloads = buildLocalShareSaveFilePayloads(
			[
				{
					name: 'Alpha',
					logo: '/alpha-next.png',
					url: 'https://alpha.dev',
					description: 'alpha next',
					tags: ['tool'],
					stars: 5
				}
			],
			JSON.stringify({
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
					},
					archived: {
						slug: 'archived',
						name: 'Archived',
						logo: '/archived.png',
						url: 'https://archived.dev',
						description: 'archived',
						tags: ['legacy'],
						stars: 1,
						category: 'legacy',
						folderPath: '/legacy/old',
						status: 'archived'
					}
				}
			})
		)

		const listPayload = JSON.parse(payloads.find(payload => payload.path === 'public/share/list.json')!.content)
		const storagePayload = JSON.parse(payloads.find(payload => payload.path === 'public/share/storage.json')!.content)

		assert.deepEqual(listPayload, [
			{
				name: 'Alpha',
				logo: '/alpha-next.png',
				url: 'https://alpha.dev',
				description: 'alpha next',
				tags: ['tool'],
				stars: 5,
				category: 'tool',
				folderPath: '/alpha/tools'
			}
		])
		assert.equal(storagePayload.shares.archived.status, 'archived')
		assert.equal(storagePayload.shares.alpha.category, 'tool')
		assert.equal(storagePayload.shares.alpha.folderPath, '/alpha/tools')
	})

	it('保存时会移除已删除的 published 记录但保留 archived 记录', () => {
		const payloads = buildLocalShareSaveFilePayloads(
			[],
			JSON.stringify({
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
					archived: {
						slug: 'archived',
						name: 'Archived',
						logo: '/archived.png',
						url: 'https://archived.dev',
						description: 'archived',
						tags: ['legacy'],
						stars: 1,
						status: 'archived'
					}
				}
			})
		)

		const listPayload = JSON.parse(payloads.find(payload => payload.path === 'public/share/list.json')!.content)
		const storagePayload = JSON.parse(payloads.find(payload => payload.path === 'public/share/storage.json')!.content)

		assert.deepEqual(listPayload, [])
		assert.equal(storagePayload.shares.alpha, undefined)
		assert.equal(storagePayload.shares.archived.status, 'archived')
	})

	it('当前 published 与 archived 同 URL 时会保留 archived 并新增 published 记录', () => {
		const payloads = buildLocalShareSaveFilePayloads(
			[
				{
					name: 'Alpha',
					logo: '/alpha-next.png',
					url: 'https://alpha.dev',
					description: 'alpha next',
					tags: ['tool'],
					stars: 5
				}
			],
			JSON.stringify({
				version: 1,
				updatedAt: '2026-04-07T00:00:00.000Z',
				shares: {
					archived: {
						slug: 'archived',
						name: 'Archived Alpha',
						logo: '/archived.png',
						url: 'https://alpha.dev',
						description: 'archived',
						tags: ['legacy'],
						stars: 1,
						status: 'archived'
					}
				}
			})
		)

		const listPayload = JSON.parse(payloads.find(payload => payload.path === 'public/share/list.json')!.content)
		const storagePayload = JSON.parse(payloads.find(payload => payload.path === 'public/share/storage.json')!.content)

		assert.equal(listPayload.length, 1)
		assert.equal(listPayload[0].url, 'https://alpha.dev')
		assert.equal(storagePayload.shares.archived.status, 'archived')
		assert.equal(Object.values(storagePayload.shares).filter((item: any) => item.status === 'published').length, 1)
	})

	it('修改 URL 时不会残留旧 published 记录，并保留既有未暴露字段', () => {
		const payloads = buildLocalShareSaveFilePayloads(
			[
				{
					name: 'Alpha',
					logo: '/alpha-next.png',
					url: 'https://alpha-next.dev',
					description: 'alpha next',
					tags: ['tool'],
					stars: 5
				}
			],
			JSON.stringify({
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
			}),
			new Map([['https://alpha-next.dev', 'https://alpha.dev']])
		)

		const listPayload = JSON.parse(payloads.find(payload => payload.path === 'public/share/list.json')!.content)
		const storagePayload = JSON.parse(payloads.find(payload => payload.path === 'public/share/storage.json')!.content)

		assert.deepEqual(listPayload, [
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
		])
		assert.equal(Object.values(storagePayload.shares).filter((item: any) => item.status === 'published').length, 1)
		assert.equal(Object.values(storagePayload.shares).some((item: any) => item.url === 'https://alpha.dev'), false)
		assert.equal(Object.values(storagePayload.shares).some((item: any) => item.url === 'https://alpha-next.dev'), true)
		assert.equal(Object.values(storagePayload.shares)[0].category, 'tool')
		assert.equal(Object.values(storagePayload.shares)[0].folderPath, '/alpha/tools')
	})

	it('同名不同 URL 的 share 会生成不同 slug', () => {
		const db = buildShareStorageFromList([
			{ name: 'Alpha', logo: '/1.png', url: 'https://alpha-1.dev', description: 'a1', tags: ['tool'], stars: 4 },
			{ name: 'Alpha', logo: '/2.png', url: 'https://alpha-2.dev', description: 'a2', tags: ['tool'], stars: 5 }
		])

		assert.deepEqual(Object.keys(db.shares), ['alpha', 'alpha-2'])
		assert.equal(db.shares.alpha.url, 'https://alpha-1.dev')
		assert.equal(db.shares['alpha-2'].url, 'https://alpha-2.dev')
	})

	it('本地保存会写出 share 的四份正式产物', () => {
		const payloads = buildLocalShareSaveFilePayloads([
			{
				name: 'Alpha',
				logo: '/alpha.png',
				url: 'https://alpha.dev',
				description: 'alpha',
				tags: ['tool'],
				stars: 4,
				category: 'tool',
				folderPath: '/alpha/tools'
			}
		])

		assert.deepEqual(
			payloads.map(payload => payload.path),
			['public/share/list.json', 'public/share/categories.json', 'public/share/folders.json', 'public/share/storage.json']
		)

		const categoriesPayload = payloads.find(payload => payload.path === 'public/share/categories.json')
		assert.equal(categoriesPayload?.content, JSON.stringify({ categories: ['tool'] }, null, 2))
	})

	it('list 导出显式携带 category 与 folderPath，空白值会被省略', () => {
		const payloads = buildLocalShareSaveFilePayloads([
			{
				name: 'Alpha',
				logo: '/alpha.png',
				url: 'https://alpha.dev',
				description: 'alpha',
				tags: ['tool'],
				stars: 4,
				category: ' 工具 ',
				folderPath: ' /设计//图片 '
			},
			{
				name: 'Beta',
				logo: '/beta.png',
				url: 'https://beta.dev',
				description: 'beta',
				tags: ['design'],
				stars: 5,
				category: '   ',
				folderPath: '   '
			}
		])

		const listPayload = JSON.parse(payloads.find(payload => payload.path === 'public/share/list.json')!.content)

		assert.deepEqual(listPayload, [
			{
				name: 'Alpha',
				logo: '/alpha.png',
				url: 'https://alpha.dev',
				description: 'alpha',
				tags: ['tool'],
				stars: 4,
				category: '工具',
				folderPath: '/设计/图片'
			},
			{
				name: 'Beta',
				logo: '/beta.png',
				url: 'https://beta.dev',
				description: 'beta',
				tags: ['design'],
				stars: 5
			}
		])
	})

	it('新建 share 与既有 published URL 冲突时会在写出前失败', () => {
		let payloads: ReturnType<typeof buildLocalShareSaveFilePayloads> | undefined

		assert.throws(
			() => {
				payloads = buildLocalShareSaveFilePayloads(
					[
						{
							name: 'Alpha',
							logo: '/alpha.png',
							url: 'https://alpha.dev',
							description: 'alpha',
							tags: ['tool'],
							stars: 4
						},
						{
							name: 'New Alpha',
							logo: '/alpha-next.png',
							url: 'https://alpha.dev',
							description: 'next',
							tags: ['tool'],
							stars: 5
						}
					],
					createStorageRaw({
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
					})
				)
			},
			/URL 已存在/
		)

		assert.equal(payloads, undefined)
	})

	it('编辑 share 改到另一个已存在 published URL 时会在写出前失败', () => {
		assert.throws(
			() =>
				buildLocalShareSaveFilePayloads(
					[
						{
							name: 'Alpha',
							logo: '/alpha-next.png',
							url: 'https://beta.dev',
							description: 'alpha next',
							tags: ['tool'],
							stars: 5
						},
						{
							name: 'Beta',
							logo: '/beta.png',
							url: 'https://beta.dev',
							description: 'beta',
							tags: ['design'],
							stars: 4
						}
					],
					createStorageRaw({
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
					}),
					new Map([['https://beta.dev', 'https://alpha.dev']])
				),
			/URL 已存在/
		)
	})

	it('同次保存内重复目标 URL 会整体失败', () => {
		assert.throws(
			() =>
				buildLocalShareSaveFilePayloads([
					{
						name: 'Alpha',
						logo: '/alpha.png',
						url: 'https://dup.dev',
						description: 'alpha',
						tags: ['tool'],
						stars: 4
					},
					{
						name: 'Beta',
						logo: '/beta.png',
						url: 'https://dup.dev',
						description: 'beta',
						tags: ['design'],
						stars: 5
					}
				]),
			/URL 已存在/
		)
	})

	it('同次保存内 URL swap / rebind 会被拒绝', () => {
		assert.throws(
			() =>
				buildLocalShareSaveFilePayloads(
					[
						{
							name: 'Alpha',
							logo: '/alpha-next.png',
							url: 'https://beta.dev',
							description: 'alpha next',
							tags: ['tool'],
							stars: 5
						},
						{
							name: 'Beta',
							logo: '/beta-next.png',
							url: 'https://alpha.dev',
							description: 'beta next',
							tags: ['design'],
							stars: 4
						}
					],
					createStorageRaw({
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
					}),
					new Map([
						['https://beta.dev', 'https://alpha.dev'],
						['https://alpha.dev', 'https://beta.dev']
					])
				),
			/URL 已存在/
		)
	})

	it('删除后同批复用原 URL 会被拒绝', () => {
		assert.throws(
			() =>
				buildLocalShareSaveFilePayloads(
					[
						{
							name: 'Beta',
							logo: '/beta-next.png',
							url: 'https://alpha.dev',
							description: 'beta next',
							tags: ['design'],
							stars: 5
						}
					],
					createStorageRaw({
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
					}),
					new Map([['https://alpha.dev', 'https://beta.dev']])
				),
			/URL 已存在/
		)
	})

	it('重命名后同批复用被腾出的旧 URL 会被拒绝', () => {
		assert.throws(
			() =>
				buildLocalShareSaveFilePayloads(
					[
						{
							name: 'Alpha',
							logo: '/alpha-next.png',
							url: 'https://beta.dev',
							description: 'alpha next',
							tags: ['tool'],
							stars: 5
						},
						{
							name: 'Gamma',
							logo: '/gamma.png',
							url: 'https://alpha.dev',
							description: 'gamma',
							tags: ['design'],
							stars: 4
						}
					],
					createStorageRaw({
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
					}),
					new Map([['https://beta.dev', 'https://alpha.dev']])
				),
			/URL 已存在/
		)
	})

	it('parseShareStorageDB 会最小化清洗非法字段形状', () => {
		const db = parseShareStorageDB(
			JSON.stringify({
				version: 1,
				updatedAt: '2026-04-07T00:00:00.000Z',
				shares: {
					dirty: {
						slug: 'dirty',
						name: 'Dirty',
						logo: '/dirty.png',
						url: 'https://dirty.dev',
						description: 'dirty',
						tags: ['ok', 1],
						stars: '5',
						category: 123,
						folderPath: '   ',
						status: 'unknown'
					}
				}
			})
		)

		assert.deepEqual(db.shares.dirty.tags, [])
		assert.equal(db.shares.dirty.stars, 0)
		assert.equal(db.shares.dirty.category, undefined)
		assert.equal(db.shares.dirty.folderPath, undefined)
		assert.equal(db.shares.dirty.status, 'published')
	})
})
