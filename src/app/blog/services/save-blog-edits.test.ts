import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import { registerHooks } from 'node:module'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const srcRootUrl = new URL('../../../', import.meta.url)
const constsModuleUrl = `data:text/javascript,${encodeURIComponent(`export const GITHUB_CONFIG = { OWNER: 'owner', REPO: 'repo', BRANCH: 'main' }`)}`
const authModuleUrl = `data:text/javascript,${encodeURIComponent(`export async function getAuthToken() { throw new Error('unexpected auth call') }`)}`
const githubClientModuleUrl = `data:text/javascript,${encodeURIComponent(`
export async function createBlob() { throw new Error('unexpected github call') }
export async function createCommit() { throw new Error('unexpected github call') }
export async function createTree() { throw new Error('unexpected github call') }
export async function getRef() { throw new Error('unexpected github call') }
export function isGitHubUpdateRefConflictError() { return false }
export function throwStaleRemoteWriteConflictError(error) { throw error }
export async function listRepoFilesRecursive() { throw new Error('unexpected github call') }
export async function putFile() { throw new Error('unexpected github call') }
export async function readTextFileFromRepo() { throw new Error('unexpected github call') }
export function toBase64Utf8(input) { return Buffer.from(input, 'utf8').toString('base64') }
export async function updateRef() { throw new Error('unexpected github call') }
`)}`

function resolveProjectModule(baseUrl: URL, specifier: string) {
	const directUrl = new URL(specifier, baseUrl)
	if (existsSync(fileURLToPath(directUrl))) {
		return directUrl.href
	}

	for (const extension of ['.ts', '.tsx', '.js', '.jsx', '.json']) {
		const url = new URL(`${specifier}${extension}`, baseUrl)
		if (existsSync(fileURLToPath(url))) {
			return url.href
		}
	}

	return null
}

registerHooks({
	resolve(specifier, context, nextResolve) {
		if (specifier === 'sonner') {
			return { shortCircuit: true, url: 'data:text/javascript,export const toast = { info: () => undefined, success: () => undefined }' }
		}
		if (specifier === '@/consts') {
			return { shortCircuit: true, url: constsModuleUrl }
		}
		if (specifier === '@/lib/auth') {
			return { shortCircuit: true, url: authModuleUrl }
		}
		if (specifier === '@/lib/github-client') {
			return { shortCircuit: true, url: githubClientModuleUrl }
		}
		if (specifier === '@/config/site-content.json') {
			return { shortCircuit: true, url: 'data:text/javascript,export default {}' }
		}
		if (specifier.startsWith('@/')) {
			const url = resolveProjectModule(srcRootUrl, specifier.slice(2))
			if (url) return { shortCircuit: true, url }
		}
		if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL) {
			const url = resolveProjectModule(new URL(context.parentURL), specifier)
			if (url) return { shortCircuit: true, url }
		}
		return nextResolve(specifier, context)
	}
})

const { buildArtifactsForSaveBlogEdits } = await import('./save-blog-edits.ts')
const { buildLocalSaveFilePayloadsFromContents, mergeCategoriesForSave } = await import('./save-blog-edits-utils.ts')

describe('mergeCategoriesForSave', () => {
	it('优先保留显式传入分类顺序，并保留未分配分类', () => {
		const merged = mergeCategoriesForSave(['前端', '后端', '归档'], ['后端', '前端'])
		assert.deepEqual(merged, ['前端', '后端', '归档'])
	})

	it('当显式分类缺失时，追加文章中派生出的分类', () => {
		const merged = mergeCategoriesForSave(['前端'], ['后端', '前端', '数据'])
		assert.deepEqual(merged, ['前端', '后端', '数据'])
	})
})

describe('buildLocalSaveFilePayloadsFromContents', () => {
	it('本地开发保存应同时生成 index/categories/folders/storage 四个文件', () => {
		const payloads = buildLocalSaveFilePayloadsFromContents({
			index: '[]',
			categories: '{"categories":[]}',
			folders: '[]',
			storage: '{"version":1}'
		})

		assert.deepEqual(
			payloads.map(item => item.path).sort(),
			[
				'public/blogs/categories.json',
				'public/blogs/folders.json',
				'public/blogs/index.json',
				'public/blogs/storage.json'
			]
		)
	})
})

describe('buildArtifactsForSaveBlogEdits', () => {
	it('删除文章前会拒绝不安全的历史 slug', () => {
		assert.throws(
			() =>
				buildArtifactsForSaveBlogEdits({
					originalItems: [
						{
							slug: '../secret',
							title: '旧文章',
							tags: [],
							date: '2026-05-04T00:00:00.000Z'
						}
					],
					nextItems: [],
					categories: [],
					existingStorageRaw: JSON.stringify({
						version: 1,
						updatedAt: '2026-05-04T00:00:00.000Z',
						blogs: {}
					})
				}),
			/slug 只能使用小写字母、数字和单个连字符/
		)
	})

	it('保存列表编辑时只覆盖实际修改项并保留远端未改动项', () => {
		const originalItems = [
			{ slug: 'changed-post', title: '旧标题', tags: ['a'], date: '2026-05-01T00:00:00.000Z', category: '旧分类' },
			{ slug: 'untouched-post', title: '旧未改动标题', tags: ['b'], date: '2026-05-02T00:00:00.000Z' }
		]
		const nextItems = [
			{ slug: 'changed-post', title: '新标题', tags: ['a'], date: '2026-05-01T00:00:00.000Z', category: '旧分类' },
			{ slug: 'untouched-post', title: '旧未改动标题', tags: ['b'], date: '2026-05-02T00:00:00.000Z' }
		]
		const artifacts = buildArtifactsForSaveBlogEdits({
			originalItems,
			nextItems,
			categories: [],
			existingStorageRaw: JSON.stringify({
				version: 1,
				updatedAt: '2026-05-04T00:00:00.000Z',
				blogs: {
					'changed-post': {
						slug: 'changed-post',
						title: '旧标题',
						tags: ['a'],
						date: '2026-05-01T00:00:00.000Z',
						category: '旧分类',
						status: 'published'
					},
					'untouched-post': {
						slug: 'untouched-post',
						title: '远端新标题',
						tags: ['b'],
						date: '2026-05-02T00:00:00.000Z',
						summary: '远端新增摘要',
						status: 'published'
					}
				}
			}),
			now: new Date('2026-05-05T00:00:00.000Z')
		})

		assert.equal(artifacts.storage.blogs['changed-post'].title, '新标题')
		assert.equal(artifacts.storage.blogs['untouched-post'].title, '远端新标题')
		assert.equal(artifacts.storage.blogs['untouched-post'].summary, '远端新增摘要')
	})

	it('保存已被远端更新的文章时应阻断覆盖', () => {
		assert.throws(
			() =>
				buildArtifactsForSaveBlogEdits({
					originalItems: [{ slug: 'post-1', title: '旧标题', tags: [], date: '2026-05-01T00:00:00.000Z' }],
					nextItems: [{ slug: 'post-1', title: '本地新标题', tags: [], date: '2026-05-01T00:00:00.000Z' }],
					categories: [],
					existingStorageRaw: JSON.stringify({
						version: 1,
						updatedAt: '2026-05-04T00:00:00.000Z',
						blogs: {
							'post-1': {
								slug: 'post-1',
								title: '远端新标题',
								tags: [],
								date: '2026-05-01T00:00:00.000Z',
								status: 'published'
							}
						}
					})
				}),
			/远端内容已更新/
		)
	})

	it('删除已被远端更新的文章时应阻断删除', () => {
		assert.throws(
			() =>
				buildArtifactsForSaveBlogEdits({
					originalItems: [{ slug: 'post-1', title: '旧标题', tags: [], date: '2026-05-01T00:00:00.000Z' }],
					nextItems: [],
					categories: [],
					existingStorageRaw: JSON.stringify({
						version: 1,
						updatedAt: '2026-05-04T00:00:00.000Z',
						blogs: {
							'post-1': {
								slug: 'post-1',
								title: '远端新标题',
								tags: [],
								date: '2026-05-01T00:00:00.000Z',
								status: 'published'
							}
						}
					})
				}),
			/远端内容已更新/
		)
	})
})

describe('saveBlogEdits remote stale write protection', () => {
	it('远端保存遇到分支更新冲突时应阻断旧状态覆盖', async () => {
		const source = (await fs.readFile(new URL('./save-blog-edits.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

		assert.match(source, /async function attemptSaveBlogEdits\(\): Promise<SaveBlogEditsArtifacts>/)
		assert.match(source, /const storageRaw = await readTextFileFromRepo\([^\n]*storagePath, latestCommitSha\)/)
		assert.doesNotMatch(source, /catch\s*\{\s*storageRaw = null\s*\}/)
		assert.match(source, /catch \(error\) \{\n\s*throwStaleRemoteWriteConflictError\(error\)/)
		assert.doesNotMatch(source, /catch \(error\) \{[\s\S]*attemptSaveBlogEdits\(\)/)
		assert.match(source, /const refData = await getRef[\s\S]*?const storageRaw = await readTextFileFromRepo\([^\n]*latestCommitSha\)[\s\S]*?await updateRef\(token, GITHUB_CONFIG\.OWNER, GITHUB_CONFIG\.REPO, `heads\/\$\{GITHUB_CONFIG\.BRANCH\}`, commitData\.sha\)/)
	})
})
