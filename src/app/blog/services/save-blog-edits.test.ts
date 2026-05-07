import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { describe, it } from 'node:test'

import { buildArtifactsForSaveBlogEdits } from './save-blog-edits.ts'
import { buildLocalSaveFilePayloadsFromContents, mergeCategoriesForSave } from './save-blog-edits-utils.ts'

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
})

describe('saveBlogEdits remote update retry', () => {
	it('远端保存遇到分支更新冲突时应重新执行完整保存流程', async () => {
		const source = (await fs.readFile(new URL('./save-blog-edits.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

		assert.match(source, /async function attemptSaveBlogEdits\(\): Promise<SaveBlogEditsArtifacts>/)
		assert.match(source, /const storageRaw = await readTextFileFromRepo\([^\n]*storagePath, latestCommitSha\)/)
		assert.doesNotMatch(source, /catch\s*\{\s*storageRaw = null\s*\}/)
		assert.match(source, /if \(isGitHubUpdateRefConflictError\(error\)\) \{\n\s*toast\.info\('分支已更新，正在重新保存\.\.\.'\)\n\s*const artifacts = await attemptSaveBlogEdits\(\)/)
		assert.match(source, /const refData = await getRef[\s\S]*?const storageRaw = await readTextFileFromRepo\([^\n]*latestCommitSha\)[\s\S]*?await updateRef\(token, GITHUB_CONFIG\.OWNER, GITHUB_CONFIG\.REPO, `heads\/\$\{GITHUB_CONFIG\.BRANCH\}`, commitData\.sha\)/)
	})
})
