import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	rebuildShareRuntimeArtifactsFromStorage,
	syncShareRuntimeArtifactsToLedger,
	verifyShareLedgerAgainstRuntime
} from './share-migration-contracts.ts'

function createStorageRaw(
	shares: Record<string, Record<string, unknown>>,
	updatedAt = '2026-04-19T00:00:00.000Z'
): string {
	return JSON.stringify(
		{
			version: 1,
			updatedAt,
			shares
		},
		null,
		2
	)
}

describe('share migration contracts', () => {
	it('verify 对 whitespace / key order / newline formatting 不报 drift', () => {
		const storageRaw = createStorageRaw({
			alpha: {
				slug: 'alpha',
				name: 'Alpha',
				logo: '/alpha.png',
				url: 'https://alpha.dev',
				description: 'alpha',
				tags: ['tool'],
				stars: 4,
				category: 'tool',
				folderPath: '/design/tools',
				status: 'published'
			}
		})

		const result = verifyShareLedgerAgainstRuntime({
			storage: storageRaw,
			runtimeArtifacts: {
				list: '[{"url":"https://alpha.dev","name":"Alpha","description":"alpha","logo":"/alpha.png","stars":4,"tags":["tool"],"folderPath":"/design/tools","category":"tool"}]\n',
				categories: '\n{  "categories": ["tool"]}\n',
				folders:
					'[\n  {"children":[{"children":[],"path":"/design/tools","name":"tools"}],"path":"/design","name":"design"}\n]\n',
				storage:
					'{"updatedAt":"2026-04-19T00:00:00.000Z","shares":{"alpha":{"url":"https://alpha.dev","status":"published","name":"Alpha","description":"alpha","folderPath":"/design/tools","logo":"/alpha.png","tags":["tool"],"slug":"alpha","category":"tool","stars":4}},"version":1}\n'
			}
		})

		assert.deepEqual(result.artifactsToRebuild, [])
		assert.equal(result.normalized.storage.updatedAt, undefined)
	})

	it('storage.updatedAt 差异不会制造 drift', () => {
		const storageRaw = createStorageRaw({
			alpha: {
				slug: 'alpha',
				name: 'Alpha',
				logo: '/alpha.png',
				url: 'https://alpha.dev',
				description: 'alpha',
				tags: ['tool'],
				stars: 4,
				category: 'tool',
				folderPath: '/design/tools',
				status: 'published'
			}
		})
		const rebuilt = rebuildShareRuntimeArtifactsFromStorage(storageRaw)
		const runtimeStorage = JSON.stringify(
			{
				...JSON.parse(rebuilt.artifacts.storage),
				updatedAt: '2036-01-01T00:00:00.000Z'
			},
			null,
			2
		)

		const result = verifyShareLedgerAgainstRuntime({
			storage: storageRaw,
			runtimeArtifacts: {
				...rebuilt.artifacts,
				storage: runtimeStorage
			}
		})

		assert.deepEqual(result.artifactsToRebuild, [])
		assert.equal(result.normalized.storage.updatedAt, undefined)
	})

	it('runtime -> sync -> rebuild -> verify 往返后无 drift，且保留非 published 记录', () => {
		const synced = syncShareRuntimeArtifactsToLedger({
			list: JSON.stringify([
				{
					name: 'Alpha',
					logo: '/alpha-next.png',
					url: 'https://alpha.dev',
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
					stars: 3,
					category: '设计',
					folder: ' /收藏//工具 '
				}
			]),
			storage: createStorageRaw({
				alpha: {
					slug: 'alpha',
					name: 'Alpha',
					logo: '/alpha.png',
					url: 'https://alpha.dev',
					description: 'alpha old',
					tags: ['tool'],
					stars: 4,
					category: '旧分类',
					folderPath: '/old/path',
					status: 'published'
				},
				'archive-only': {
					slug: 'archive-only',
					name: 'Archive Only',
					logo: '/archive.png',
					url: 'https://archive.dev',
					description: 'archive',
					tags: ['legacy'],
					stars: 1,
					folder: '/archive/legacy',
					status: 'archived'
				},
				'remove-me': {
					slug: 'remove-me',
					name: 'Remove Me',
					logo: '/remove.png',
					url: 'https://remove.dev',
					description: 'remove',
					tags: ['legacy'],
					stars: 1,
					status: 'published'
				}
			})
		})
		const rebuilt = rebuildShareRuntimeArtifactsFromStorage(synced.storage)
		const verified = verifyShareLedgerAgainstRuntime({
			storage: synced.storage,
			runtimeArtifacts: rebuilt.artifacts
		})

		assert.deepEqual(Object.keys(synced.storage.shares).sort(), ['alpha', 'archive-only', 'beta'])
		assert.equal(synced.storage.shares['archive-only']?.status, 'archived')
		assert.equal(synced.storage.shares.beta?.folderPath, '/收藏/工具')
		assert.deepEqual(verified.artifactsToRebuild, [])
	})

	it('rebuild 重复执行保持幂等', () => {
		const storageRaw = createStorageRaw({
			beta: {
				slug: 'beta',
				name: 'Beta',
				logo: '/beta.png',
				url: 'https://beta.dev',
				description: 'beta',
				tags: ['design'],
				stars: 3,
				category: '设计',
				folderPath: '/收藏/工具',
				status: 'published'
			}
		})

		const first = rebuildShareRuntimeArtifactsFromStorage(storageRaw)
		const second = rebuildShareRuntimeArtifactsFromStorage(first.artifacts.storage)

		assert.deepEqual(first.artifacts, second.artifacts)
	})

	it('legacy folder precedence matrix 固定且 deterministic', () => {
		const cases = [
			{
				name: 'only legacy folder',
				item: { folder: ' /legacy//only ' },
				expectedFolderPath: '/legacy/only'
			},
			{
				name: 'only folderPath',
				item: { folderPath: ' /canonical//path ' },
				expectedFolderPath: '/canonical/path'
			},
			{
				name: 'both same',
				item: { folder: '/same/path', folderPath: ' /same//path ' },
				expectedFolderPath: '/same/path'
			},
			{
				name: 'folderPath wins over conflicting legacy folder',
				item: { folder: '/legacy/path', folderPath: '/canonical/path' },
				expectedFolderPath: '/canonical/path'
			}
		]

		for (const testCase of cases) {
			const synced = syncShareRuntimeArtifactsToLedger({
				list: JSON.stringify([
					{
						name: 'Alpha',
						logo: '/alpha.png',
						url: 'https://alpha.dev',
						description: 'alpha',
						tags: ['tool'],
						stars: 4,
						...testCase.item
					}
				]),
				storage: createStorageRaw({})
			})
			const rebuilt = rebuildShareRuntimeArtifactsFromStorage(synced.storage)
			const record = synced.storage.shares.alpha
			const listItem = JSON.parse(rebuilt.artifacts.list)[0] as Record<string, unknown>

			assert.equal(record?.folderPath, testCase.expectedFolderPath, testCase.name)
			assert.equal(listItem.folderPath, testCase.expectedFolderPath, testCase.name)
			assert.equal(Object.prototype.hasOwnProperty.call(listItem, 'folder'), false, testCase.name)
		}
	})

	it('清空 category / folderPath 时不会残留旧值', () => {
		const synced = syncShareRuntimeArtifactsToLedger({
			list: JSON.stringify([
				{
					name: 'Alpha',
					logo: '/alpha-next.png',
					url: 'https://alpha.dev',
					description: 'alpha next',
					tags: ['tool'],
					stars: 5,
					category: '   ',
					folderPath: '   '
				}
			]),
			storage: createStorageRaw({
				alpha: {
					slug: 'alpha',
					name: 'Alpha',
					logo: '/alpha.png',
					url: 'https://alpha.dev',
					description: 'alpha',
					tags: ['tool'],
					stars: 4,
					category: 'tool',
					folder: '/legacy/path',
					folderPath: '/old/path',
					status: 'published'
				}
			})
		})
		const rebuilt = rebuildShareRuntimeArtifactsFromStorage(synced.storage)
		const storageRecord = JSON.parse(synced.storageRaw).shares.alpha as Record<string, unknown>
		const listItem = JSON.parse(rebuilt.artifacts.list)[0] as Record<string, unknown>

		assert.equal(Object.prototype.hasOwnProperty.call(storageRecord, 'category'), false)
		assert.equal(Object.prototype.hasOwnProperty.call(storageRecord, 'folderPath'), false)
		assert.equal(Object.prototype.hasOwnProperty.call(storageRecord, 'folder'), false)
		assert.equal(Object.prototype.hasOwnProperty.call(listItem, 'category'), false)
		assert.equal(Object.prototype.hasOwnProperty.call(listItem, 'folderPath'), false)
	})

	it('canonical compare 会报告真实 drift，但不会改写 runtime 写出顺序契约', () => {
		const storageRaw = createStorageRaw({
			beta: {
				slug: 'beta',
				name: 'Beta',
				logo: '/beta.png',
				url: 'https://beta.dev',
				description: 'beta',
				tags: ['design'],
				stars: 3,
				category: 'design',
				folderPath: '/beta/design',
				status: 'published'
			},
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
		})
		const rebuilt = rebuildShareRuntimeArtifactsFromStorage(storageRaw)
		const rebuiltList = JSON.parse(rebuilt.artifacts.list) as Array<{ name: string }>
		const runtimeStorage = createStorageRaw(
			{
				alpha: {
					slug: 'alpha',
					name: 'Alpha',
					logo: '/alpha.png',
					url: 'https://alpha.dev',
					description: 'alpha drift',
					tags: ['tool'],
					stars: 4,
					category: 'tool',
					folderPath: '/alpha/tools',
					status: 'published'
				},
				beta: {
					slug: 'beta',
					name: 'Beta',
					logo: '/beta.png',
					url: 'https://beta.dev',
					description: 'beta',
					tags: ['design'],
					stars: 3,
					category: 'design',
					folderPath: '/beta/design',
					status: 'published'
				}
			},
			'2040-01-01T00:00:00.000Z'
		)
		const result = verifyShareLedgerAgainstRuntime({
			storage: storageRaw,
			runtimeArtifacts: {
				list: JSON.stringify(
					[
						{
							name: 'Alpha',
							logo: '/alpha.png',
							url: 'https://alpha.dev',
							description: 'alpha drift',
							tags: ['tool'],
							stars: 4,
							category: 'tool',
							folderPath: '/alpha/tools'
						},
						{
							name: 'Beta',
							logo: '/beta.png',
							url: 'https://beta.dev',
							description: 'beta',
							tags: ['design'],
							stars: 3,
							category: 'design',
							folderPath: '/beta/design'
						}
					],
					null,
					2
				),
				categories: rebuilt.artifacts.categories,
				folders: rebuilt.artifacts.folders,
				storage: runtimeStorage
			}
		})

		assert.deepEqual(
			rebuiltList.map(item => item.name),
			['Beta', 'Alpha']
		)
		assert.deepEqual(result.artifactsToRebuild, ['public/share/list.json', 'public/share/storage.json'])
	})

	it('verify 遇到非法 JSON 会抛明确错误，而不是透出裸解析异常', () => {
		const storageRaw = createStorageRaw({})

		assert.throws(
			() =>
				verifyShareLedgerAgainstRuntime({
					storage: storageRaw,
					runtimeArtifacts: {
						list: '{',
						categories: '{"categories":[]}',
						folders: '[]',
						storage: storageRaw
					}
				}),
			(error: unknown) => {
				assert.equal(error instanceof Error, true)
				assert.match((error as Error).message, /runtimeArtifacts\.list/)
				assert.match((error as Error).message, /非法 JSON/)
				return true
			}
		)
	})

	it('verify 遇到非法 shape 会抛明确错误，而不是静默降级为空结构', () => {
		assert.throws(
			() =>
				verifyShareLedgerAgainstRuntime({
					storage: {
						version: 1,
						shares: []
					} as unknown as Parameters<typeof verifyShareLedgerAgainstRuntime>[0]['storage'],
					runtimeArtifacts: {
						list: '[]',
						categories: '{"categories":[]}',
						folders: '[]',
						storage: createStorageRaw({})
					}
				}),
			(error: unknown) => {
				assert.equal(error instanceof Error, true)
				assert.match((error as Error).message, /storage/)
				assert.match((error as Error).message, /shares/)
				assert.match((error as Error).message, /shape/)
				return true
			}
		)
	})
})
