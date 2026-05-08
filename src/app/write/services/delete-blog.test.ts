import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import { registerHooks } from 'node:module'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const srcRootUrl = new URL('../../../', import.meta.url)

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
			return {
				shortCircuit: true,
				url: 'data:text/javascript,export const toast = { info: () => undefined, success: () => undefined }'
			}
		}

		if (specifier === '@/config/site-content.json') {
			return {
				shortCircuit: true,
				url: 'data:text/javascript,export default {}'
			}
		}

		if (context.parentURL && specifier.endsWith('site-content.json')) {
			const directUrl = new URL(specifier, context.parentURL)
			if (fileURLToPath(directUrl).endsWith('/src/config/site-content.json')) {
				return {
					shortCircuit: true,
					url: 'data:text/javascript,export default {}'
				}
			}
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

const { buildBatchDeleteArtifactContents, buildDeleteArtifactContents, hasBlogRecordForDelete } = await import('./delete-blog.ts')

describe('buildDeleteArtifactContents', () => {
	it('远端删除应同时生成 index/categories/folders/storage 四个正式产物内容', async () => {
		const artifacts = await buildDeleteArtifactContents({
			slug: 'post-1',
			readStorageRaw: async () =>
				JSON.stringify({
					version: 1,
					updatedAt: '2026-03-27T10:00:00.000Z',
					blogs: {
						'post-1': {
							slug: 'post-1',
							title: '标题',
							tags: ['a'],
							date: '2026-03-27T10:00:00.000Z',
							category: '分类A',
							folderPath: '/写作/技术',
							favorite: true,
							status: 'published'
						}
					}
				}),
			fallbackReadIndexRaw: async () =>
				JSON.stringify([
					{
						slug: 'post-1',
						title: '标题',
						tags: ['a'],
						date: '2026-03-27T10:00:00.000Z',
						category: '分类A',
						folderPath: '/写作/技术',
						favorite: true
					}
				])
		})

		assert.deepEqual(Object.keys(artifacts).sort(), ['categories', 'folders', 'index', 'storage'])
		assert.deepEqual(JSON.parse(artifacts.index), [])
		assert.deepEqual(JSON.parse(artifacts.categories).categories, [])
		assert.deepEqual(JSON.parse(artifacts.folders), [])
		assert.deepEqual(JSON.parse(artifacts.storage).blogs, {})
	})

	it('远端批量删除应从四个正式产物中移除多个 slug', async () => {
		const artifacts = await buildBatchDeleteArtifactContents({
			slugs: ['post-1', 'post-2', 'post-1'],
			readStorageRaw: async () =>
				JSON.stringify({
					version: 1,
					updatedAt: '2026-03-27T10:00:00.000Z',
					blogs: {
						'post-1': {
							slug: 'post-1',
							title: '标题1',
							tags: ['a'],
							date: '2026-03-27T10:00:00.000Z',
							category: '分类A',
							folderPath: '/写作',
							status: 'published'
						},
						'post-2': {
							slug: 'post-2',
							title: '标题2',
							tags: ['b'],
							date: '2026-03-28T10:00:00.000Z',
							category: '分类B',
							folderPath: '/归档',
							status: 'published'
						},
						'post-3': {
							slug: 'post-3',
							title: '标题3',
							tags: ['c'],
							date: '2026-03-29T10:00:00.000Z',
							category: '分类C',
							folderPath: '/保留',
							status: 'published'
						}
					}
				}),
			fallbackReadIndexRaw: async () => '[]'
		})

		assert.deepEqual(JSON.parse(artifacts.index).map((item: { slug: string }) => item.slug), ['post-3'])
		assert.deepEqual(JSON.parse(artifacts.categories).categories, ['分类C'])
		assert.deepEqual(JSON.parse(artifacts.folders).map((item: { path: string }) => item.path), ['/保留'])
		assert.deepEqual(Object.keys(JSON.parse(artifacts.storage).blogs), ['post-3'])
	})
})

describe('hasBlogRecordForDelete', () => {
	it('文章目录缺失时仍能识别 storage 或 index 中的残留记录', () => {
		assert.equal(
			hasBlogRecordForDelete({
				slug: 'post-1',
				storageRaw: JSON.stringify({
					version: 1,
					updatedAt: '2026-03-27T10:00:00.000Z',
					blogs: {
						'post-1': {
							slug: 'post-1',
							title: '标题',
							tags: [],
							date: '2026-03-27T10:00:00.000Z',
							status: 'published'
						}
					}
				}),
				indexRaw: null
			}),
			true
		)
		assert.equal(
			hasBlogRecordForDelete({
				slug: 'post-2',
				storageRaw: null,
				indexRaw: JSON.stringify([{ slug: 'post-2', title: '标题', tags: [], date: '2026-03-27T10:00:00.000Z' }])
			}),
			true
		)
		assert.equal(hasBlogRecordForDelete({ slug: 'post-3', storageRaw: null, indexRaw: '[]' }), false)
	})

	it('storage 或 legacy index 损坏时拒绝判断删除记录', () => {
		assert.throws(
			() => hasBlogRecordForDelete({ slug: 'post-1', storageRaw: '{bad json', indexRaw: null }),
			/博客 storage\.json 解析失败/
		)
		assert.throws(
			() => hasBlogRecordForDelete({ slug: 'post-1', storageRaw: null, indexRaw: '{bad json' }),
			/博客 index\.json 解析失败/
		)
	})
})

describe('deleteBlog remote update retry', () => {
	it('远端删除遇到分支更新冲突时应重新执行完整删除流程', async () => {
		const source = (await fs.readFile(new URL('./delete-blog.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

		assert.match(source, /async function attemptDeleteBlog\(\)/)
		assert.match(source, /if \(isGitHubUpdateRefConflictError\(error\)\) \{\n\s*toast\.info\('分支已更新，正在重新删除\.\.\.'\)\n\s*await attemptDeleteBlog\(\)/)
		assert.match(source, /const refData = await getRef[\s\S]*?const latestCommitSha = refData\.sha[\s\S]*?await updateRef\(token, GITHUB_CONFIG\.OWNER, GITHUB_CONFIG\.REPO, `heads\/\$\{GITHUB_CONFIG\.BRANCH\}`, commitData\.sha\)/)
	})
})
