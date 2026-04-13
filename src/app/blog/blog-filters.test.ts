import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { BlogIndexItem } from './types'
import {
	BLOG_FOLDER_ALL,
	BLOG_FOLDER_UNFILED,
	assignFolderPath,
	buildFolderGroups,
	filterBlogItems,
	retainSelectionInView
} from './blog-filters.ts'

describe('blog-filters', () => {
	const items: BlogIndexItem[] = [
		{ slug: 'a', title: 'A', tags: [], date: '2026-03-01T00:00:00.000Z', favorite: true, folderPath: '/技术/前端' },
		{ slug: 'b', title: 'B', tags: [], date: '2026-03-02T00:00:00.000Z', favorite: false, folderPath: '/生活/随笔' },
		{ slug: 'c', title: 'C', tags: [], date: '2026-03-03T00:00:00.000Z' }
	]

	it('favoritesOnly 过滤只返回 favorite=true 的文章', () => {
		const filtered = filterBlogItems(items, {
			favoritesOnly: true,
			folderPath: BLOG_FOLDER_ALL
		})

		assert.deepEqual(
			filtered.map(item => item.slug),
			['a']
		)
	})

	it('folderPath 过滤按目录路径返回文章', () => {
		const filtered = filterBlogItems(items, {
			favoritesOnly: false,
			folderPath: '/生活/随笔'
		})

		assert.deepEqual(
			filtered.map(item => item.slug),
			['b']
		)
	})

	it('未归档过滤返回没有 folderPath 的文章', () => {
		const filtered = filterBlogItems(items, {
			favoritesOnly: false,
			folderPath: BLOG_FOLDER_UNFILED
		})

		assert.deepEqual(filtered.map(item => item.slug), ['c'])
	})

	it('retainSelectionInView 应移除当前过滤视图不可见的选中项', () => {
		const selected = new Set(['a', 'c'])
		const visible = items.filter(item => item.slug === 'a')

		const retained = retainSelectionInView(selected, visible)
		assert.deepEqual(Array.from(retained).sort(), ['a'])
	})

	it('assignFolderPath 应更新选中文章的 folderPath', () => {
		const updated = assignFolderPath(items, new Set(['a', 'c']), '/归档/精选')
		assert.equal(updated.find(item => item.slug === 'a')?.folderPath, '/归档/精选')
		assert.equal(updated.find(item => item.slug === 'c')?.folderPath, '/归档/精选')
		assert.equal(updated.find(item => item.slug === 'b')?.folderPath, '/生活/随笔')
	})

	it('folder 模式分组应基于目录和未归档生成 group keys', () => {
		const result = buildFolderGroups(items)
		assert.deepEqual(result.groupKeys, ['/技术/前端', '/生活/随笔', BLOG_FOLDER_UNFILED])
		assert.equal(result.getGroupLabel('/技术/前端'), '/技术/前端')
		assert.equal(result.getGroupLabel(BLOG_FOLDER_UNFILED), '未归档')
		assert.deepEqual(result.groupedItems[BLOG_FOLDER_UNFILED].items.map(item => item.slug), ['c'])
	})

	it('folder 模式可与 favoritesOnly 组合后再分组', () => {
		const filtered = filterBlogItems(items, {
			favoritesOnly: true,
			folderPath: BLOG_FOLDER_ALL
		})
		const result = buildFolderGroups(filtered)
		assert.deepEqual(result.groupKeys, ['/技术/前端'])
		assert.deepEqual(result.groupedItems['/技术/前端'].items.map(item => item.slug), ['a'])
	})
})
