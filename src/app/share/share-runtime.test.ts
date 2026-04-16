import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	buildShareRuntimeSnapshot,
	applyCategorySelection,
	applyDirectorySelection,
	SHARE_CATEGORY_ALL,
	SHARE_DIRECTORY_ALL,
	type ShareFolderNode,
	type ShareRuntimeFilters,
	type ShareRuntimeItem
} from './share-runtime.ts'

const items: ShareRuntimeItem[] = [
	{
		name: 'Alpha Compress',
		logo: '/logos/alpha.png',
		url: 'https://alpha.dev',
		description: 'compress images fast',
		tags: ['image', 'utility'],
		stars: 4,
		category: 'tool',
		folderPath: '/design/images'
	},
	{
		name: 'Alpha Icons',
		logo: '/logos/icons.png',
		url: 'https://icons.dev',
		description: 'icon inspiration board',
		tags: ['icon', 'library'],
		stars: 4,
		category: 'inspiration',
		folderPath: '/design/images/icons'
	},
	{
		name: 'Beta Motion',
		logo: '/logos/beta.png',
		url: 'https://beta.dev',
		description: 'react animation toolkit',
		tags: ['motion', 'react'],
		stars: 5,
		category: 'tool',
		folderPath: '/dev/frontend'
	},
	{
		name: 'Beta Learn',
		logo: '/logos/learn.png',
		url: 'https://learn.dev',
		description: 'frontend deep dive tutorials',
		tags: ['docs'],
		stars: 3,
		category: 'learning',
		folderPath: '/dev/frontend'
	},
	{
		name: 'Gamma Search',
		logo: '/logos/gamma.png',
		url: 'https://gamma.dev',
		description: 'search everything',
		tags: ['search', 'utility'],
		stars: 4,
		category: 'tool'
	},
	{
		name: 'Delta Board',
		logo: '/logos/delta.png',
		url: 'https://delta.dev',
		description: 'image mood board',
		tags: ['image', 'board'],
		stars: 2,
		folderPath: '/design/images'
	}
]

const categories = ['inspiration', 'learning', 'tool']

const folders: ShareFolderNode[] = [
	{
		name: 'design',
		path: '/design',
		children: [
			{ name: 'empty', path: '/design/empty', children: [] },
			{
				name: 'images',
				path: '/design/images',
				children: [{ name: 'icons', path: '/design/images/icons', children: [] }]
			}
		]
	},
	{
		name: 'dev',
		path: '/dev',
		children: [{ name: 'frontend', path: '/dev/frontend', children: [] }]
	}
]

function createFilters(overrides: Partial<ShareRuntimeFilters> = {}): ShareRuntimeFilters {
	return {
		activeDirectory: SHARE_DIRECTORY_ALL,
		activeCategory: SHARE_CATEGORY_ALL,
		searchTerm: '',
		selectedTag: SHARE_CATEGORY_ALL,
		...overrides
	}
}

function flattenFolderPaths(nodes: ShareFolderNode[]): string[] {
	return nodes.flatMap(node => [node.path, ...flattenFolderPaths(node.children)])
}

describe('share runtime', () => {
	it('目录是主过滤轴，且父目录会包含所有子目录内容', () => {
		const result = buildShareRuntimeSnapshot({
			items,
			categories,
			folders,
			filters: createFilters({ activeDirectory: '/design' })
		})

		assert.deepEqual(
			result.visibleItems.map(item => item.url),
			['https://alpha.dev', 'https://icons.dev', 'https://delta.dev']
		)
	})

	it('分类仅在当前目录范围内过滤，不会把其他目录或未归档条目带进来', () => {
		const result = buildShareRuntimeSnapshot({
			items,
			categories,
			folders,
			filters: createFilters({
				activeDirectory: '/design',
				activeCategory: 'tool'
			})
		})

		assert.deepEqual(result.visibleItems.map(item => item.url), ['https://alpha.dev'])
		assert.deepEqual(result.availableCategories, ['all', 'inspiration', 'tool'])
	})

	it('搜索与标签会在目录和分类之后叠加过滤', () => {
		const result = buildShareRuntimeSnapshot({
			items,
			categories,
			folders,
			filters: createFilters({
				activeDirectory: '/design',
				activeCategory: 'tool',
				searchTerm: 'beta',
				selectedTag: 'react'
			})
		})

		assert.deepEqual(result.visibleItems.map(item => item.url), [])
		assert.equal(result.emptyState, 'filter-empty')
	})

	it('切换目录时若 category 仍有效则保留，并保留 searchTerm 与 selectedTag', () => {
		const next = applyDirectorySelection({
			items,
			categories,
			folders,
			current: createFilters({
				activeDirectory: '/design',
				activeCategory: 'tool',
				searchTerm: 'compress',
				selectedTag: 'image'
			}),
			nextDirectory: '/dev'
		})

		assert.equal(next.activeDirectory, '/dev')
		assert.equal(next.activeCategory, 'tool')
		assert.equal(next.searchTerm, 'compress')
		assert.equal(next.selectedTag, 'image')
	})

	it('切换目录时若 category 已失效则回退 all，并保留 searchTerm 与 selectedTag', () => {
		const next = applyDirectorySelection({
			items,
			categories,
			folders,
			current: createFilters({
				activeDirectory: '/design',
				activeCategory: 'inspiration',
				searchTerm: 'icon',
				selectedTag: 'library'
			}),
			nextDirectory: '/dev'
		})

		assert.equal(next.activeDirectory, '/dev')
		assert.equal(next.activeCategory, 'all')
		assert.equal(next.searchTerm, 'icon')
		assert.equal(next.selectedTag, 'library')
	})

	it('切换目录时若 category 只存在于 items 但不在候选 categories 中，则回退 all', () => {
		const next = applyDirectorySelection({
			items: [
				...items,
				{
					name: 'Hidden Board',
					logo: '/logos/hidden.png',
					url: 'https://hidden.dev',
					description: 'hidden category item',
					tags: ['board'],
					stars: 1,
					category: 'hidden',
					folderPath: '/design/images'
				}
			],
			categories,
			folders,
			current: createFilters({
				activeDirectory: SHARE_DIRECTORY_ALL,
				activeCategory: 'hidden'
			}),
			nextDirectory: '/design'
		})

		assert.equal(next.activeDirectory, '/design')
		assert.equal(next.activeCategory, 'all')
	})

	it('切换目录时会把空字符串或未知目录归一化为 all', () => {
		const emptyDirectory = applyDirectorySelection({
			items,
			categories,
			folders,
			current: createFilters({ activeCategory: 'tool' }),
			nextDirectory: ''
		})
		assert.equal(emptyDirectory.activeDirectory, 'all')
		assert.equal(emptyDirectory.activeCategory, 'tool')

		const unknownDirectory = applyDirectorySelection({
			items,
			categories,
			folders,
			current: createFilters({ activeCategory: 'tool' }),
			nextDirectory: '/missing'
		})
		assert.equal(unknownDirectory.activeDirectory, 'all')
		assert.equal(unknownDirectory.activeCategory, 'tool')
	})

	it('切换分类时保留目录、searchTerm 与 selectedTag', () => {
		const next = applyCategorySelection({
			items,
			categories,
			current: createFilters({
				activeDirectory: '/design',
				activeCategory: 'all',
				searchTerm: 'board',
				selectedTag: 'image'
			}),
			nextCategory: 'tool'
		})

		assert.equal(next.activeDirectory, '/design')
		assert.equal(next.activeCategory, 'tool')
		assert.equal(next.searchTerm, 'board')
		assert.equal(next.selectedTag, 'image')
	})

	it('切换分类时会把空字符串、未知值和当前目录不可用分类归一化为 all', () => {
		const emptyCategory = applyCategorySelection({
			items,
			categories,
			current: createFilters({
				activeDirectory: '/design',
				searchTerm: 'board',
				selectedTag: 'image'
			}),
			nextCategory: ''
		})
		assert.equal(emptyCategory.activeCategory, 'all')
		assert.equal(emptyCategory.activeDirectory, '/design')
		assert.equal(emptyCategory.searchTerm, 'board')
		assert.equal(emptyCategory.selectedTag, 'image')

		const unknownCategory = applyCategorySelection({
			items,
			categories,
			current: createFilters({ activeDirectory: '/design' }),
			nextCategory: 'missing'
		})
		assert.equal(unknownCategory.activeCategory, 'all')

		const unavailableCategory = applyCategorySelection({
			items,
			categories,
			current: createFilters({ activeDirectory: '/design' }),
			nextCategory: 'learning'
		})
		assert.equal(unavailableCategory.activeCategory, 'all')
	})

	it('snapshot 会把候选源外的 activeCategory 归一化为 all，避免返回 UI 不会显示的状态', () => {
		const result = buildShareRuntimeSnapshot({
			items: [
				...items,
				{
					name: 'Hidden Board',
					logo: '/logos/hidden.png',
					url: 'https://hidden.dev',
					description: 'hidden category item',
					tags: ['board'],
					stars: 1,
					category: 'hidden',
					folderPath: '/design/images'
				}
			],
			categories,
			folders,
			filters: createFilters({
				activeDirectory: '/design',
				activeCategory: 'hidden'
			})
		})

		assert.equal(result.activeCategory, 'all')
		assert.equal(result.emptyState, null)
		assert.deepEqual(result.availableCategories, ['all', 'inspiration', 'tool'])
		assert.deepEqual(
			result.visibleItems.map(item => item.url),
			['https://alpha.dev', 'https://icons.dev', 'https://delta.dev', 'https://hidden.dev']
		)
	})

	it('snapshot 不会把没有任何 share 的空目录节点暴露给前台', () => {
		const result = buildShareRuntimeSnapshot({
			items,
			categories,
			folders,
			filters: createFilters()
		})

		assert.equal(flattenFolderPaths(result.directoryTree).includes('/design/empty'), false)
	})

	it('未归档条目出现在 all-directory 汇总结果里，但不会生成假目录节点', () => {
		const result = buildShareRuntimeSnapshot({
			items,
			categories,
			folders,
			filters: createFilters()
		})

		assert.equal(result.visibleItems.some(item => item.url === 'https://gamma.dev'), true)
		assert.deepEqual(flattenFolderPaths(result.directoryTree), ['/design', '/design/images', '/design/images/icons', '/dev', '/dev/frontend'])
	})

	it('无分类条目出现在 all 结果里，但不会生成单独分类 tab', () => {
		const result = buildShareRuntimeSnapshot({
			items,
			categories,
			folders,
			filters: createFilters()
		})

		assert.equal(result.visibleItems.some(item => item.url === 'https://delta.dev'), true)
		assert.deepEqual(result.availableCategories, ['all', 'inspiration', 'learning', 'tool'])
	})

	it('snapshot 会在全局候选合法但当前目录无结果时保留分类并返回 category-empty', () => {
		const result = buildShareRuntimeSnapshot({
			items,
			categories,
			folders,
			filters: createFilters({
				activeDirectory: '/design',
				activeCategory: 'learning'
			})
		})

		assert.equal(result.activeCategory, 'learning')
		assert.deepEqual(result.availableCategories, ['all', 'inspiration', 'tool'])
		assert.deepEqual(result.visibleItems, [])
		assert.equal(result.emptyState, 'category-empty')
	})

	it('snapshot 会区分 directory-empty / filter-empty / global-empty，并把无效分类归一化为 all', () => {
		const directoryEmpty = buildShareRuntimeSnapshot({
			items,
			categories,
			folders,
			filters: createFilters({ activeDirectory: '/design/empty' })
		})
		assert.equal(directoryEmpty.emptyState, 'directory-empty')

		const invalidCategory = buildShareRuntimeSnapshot({
			items,
			categories,
			folders,
			filters: createFilters({
				activeDirectory: '/design',
				activeCategory: 'missing'
			})
		})
		assert.equal(invalidCategory.activeCategory, 'all')
		assert.equal(invalidCategory.emptyState, null)

		const filterEmpty = buildShareRuntimeSnapshot({
			items,
			categories,
			folders,
			filters: createFilters({
				activeDirectory: '/design',
				activeCategory: 'tool',
				searchTerm: 'zzz',
				selectedTag: 'react'
			})
		})
		assert.equal(filterEmpty.emptyState, 'filter-empty')

		const globalEmpty = buildShareRuntimeSnapshot({
			items: [],
			categories,
			folders,
			filters: createFilters()
		})
		assert.equal(globalEmpty.emptyState, 'global-empty')
	})
})
