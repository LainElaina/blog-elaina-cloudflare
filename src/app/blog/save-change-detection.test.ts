import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs/promises'

import type { BlogIndexItem } from './types'

type SaveChangeDetectionModule = typeof import('./save-change-detection')

async function loadSaveChangeDetection() {
	return (await import(new URL('./save-change-detection.ts', import.meta.url).href)) as SaveChangeDetectionModule
}

describe('hasBlogSaveChanges', () => {
	const base: BlogIndexItem = {
		slug: 'post-1',
		title: '标题',
		tags: ['a'],
		date: '2026-03-27T10:00:00.000Z'
	}

	it('folderPath 变化应被识别为可保存改动', async () => {
		const { hasBlogSaveChanges } = await loadSaveChangeDetection()
		const changed = hasBlogSaveChanges({
			items: [base],
			editableItems: [{ ...base, folderPath: '/写作/技术' }],
			categoryList: [],
			categoriesFromServer: []
		})
		assert.equal(changed, true)
	})

	it('favorite 变化应被识别为可保存改动', async () => {
		const { hasBlogSaveChanges } = await loadSaveChangeDetection()
		const changed = hasBlogSaveChanges({
			items: [base],
			editableItems: [{ ...base, favorite: true }],
			categoryList: [],
			categoriesFromServer: []
		})
		assert.equal(changed, true)
	})

	it('无删除且分类与元数据均不变时返回 false', async () => {
		const { hasBlogSaveChanges } = await loadSaveChangeDetection()
		const changed = hasBlogSaveChanges({
			items: [base],
			editableItems: [{ ...base }],
			categoryList: [],
			categoriesFromServer: []
		})
		assert.equal(changed, false)
	})
})

describe('buildBlogSaveBaseline', () => {
	it('保存成功后用最终 artifacts 作为页面基线，而不是继续引用保存前数据', async () => {
		const { buildBlogSaveBaseline } = await loadSaveChangeDetection()
		const staleItem: BlogIndexItem = {
			slug: 'post-1',
			title: '标题',
			tags: ['a'],
			date: '2026-03-27T10:00:00.000Z',
			category: '旧分类'
		}
		const savedItem: BlogIndexItem = {
			...staleItem,
			category: '新分类',
			folderPath: '/写作/技术',
			favorite: true
		}

		const baseline = buildBlogSaveBaseline({
			index: [savedItem],
			categories: ['新分类'],
			folders: [
				{
					path: '/写作',
					children: [{ path: '/写作/技术' }]
				}
			]
		})

		assert.notDeepEqual(baseline.items, [staleItem])
		assert.deepEqual(baseline.items, [savedItem])
		assert.deepEqual(baseline.categories, ['新分类'])
		assert.deepEqual(baseline.folders, ['/写作', '/写作/技术'])
	})

	it('blog page 保存成功后必须把返回 artifacts 同步回列表、分类和目录基线', async () => {
		const pageSource = await fs.readFile(new URL('./page.tsx', import.meta.url), 'utf-8')

		assert.match(pageSource, /const savedBaseline = buildBlogSaveBaseline\(savedArtifacts\)/)
		assert.match(pageSource, /await mutateBlogIndex\(savedBaseline\.items, \{ revalidate: false \}\)/)
		assert.match(pageSource, /await mutateCategories\(\{ categories: savedBaseline\.categories \}, \{ revalidate: false \}\)/)
		assert.match(pageSource, /await mutateBlogFolders\(\{ folders: savedBaseline\.folders \}, \{ revalidate: false \}\)/)
	})

	it('blog page local save checks delete-dir and save-file responses before marking artifacts as saved', async () => {
		const pageSource = await fs.readFile(new URL('./page.tsx', import.meta.url), 'utf-8')

		assert.match(pageSource, /await saveLocalBlogPublishFile\(payload, '保存博客产物', writtenFiles\)/)
		assert.match(pageSource, /catch \(error\) \{\n\s*try \{\n\s*await rollbackLocalBlogPublish\(writtenFiles, uploadedFiles\)/)
		assert.match(pageSource, /catch \(rollbackError\) \{\n\s*const originalMessage = error instanceof Error \? error\.message : String\(error\)/)
		assert.match(pageSource, /const rollbackMessage = rollbackError instanceof Error \? rollbackError\.message : String\(rollbackError\)/)
		assert.match(pageSource, /throw new Error\(`\$\{originalMessage\}；本地博客保存回滚失败：\$\{rollbackMessage\}`\)/)
		assert.doesNotMatch(pageSource, /console\.warn\('本地博客保存回滚失败:', rollbackError\)/)
		assert.match(pageSource, /await assertOk\(\n\s*await fetch\('\/api\/delete-dir'/)
		assert.match(pageSource, /'删除文章目录'/)
		assert.match(pageSource, /const savedBaseline = buildBlogSaveBaseline\(savedArtifacts\)/)
	})

	it('blog page local save deletes removed article directories only after artifact writes succeed', async () => {
		const pageSource = await fs.readFile(new URL('./page.tsx', import.meta.url), 'utf-8')
		const saveArtifactsIndex = pageSource.indexOf("await saveLocalBlogPublishFile(payload, '保存博客产物', writtenFiles)")
		const deleteDirIndex = pageSource.indexOf("await fetch('/api/delete-dir'")

		assert.notEqual(saveArtifactsIndex, -1)
		assert.notEqual(deleteDirIndex, -1)
		assert.ok(saveArtifactsIndex < deleteDirIndex)
	})
})
