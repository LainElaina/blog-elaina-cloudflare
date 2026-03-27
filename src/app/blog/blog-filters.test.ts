import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { BlogIndexItem } from './types'
import { BLOG_FOLDER_ALL, assignFolderPath, filterBlogItems } from './blog-filters.ts'

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

	it('assignFolderPath 应更新选中文章的 folderPath', () => {
		const updated = assignFolderPath(items, new Set(['a', 'c']), '/归档/精选')
		assert.equal(updated.find(item => item.slug === 'a')?.folderPath, '/归档/精选')
		assert.equal(updated.find(item => item.slug === 'c')?.folderPath, '/归档/精选')
		assert.equal(updated.find(item => item.slug === 'b')?.folderPath, '/生活/随笔')
	})
})
