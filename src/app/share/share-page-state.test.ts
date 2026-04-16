import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	SHARE_CATEGORY_ALL,
	SHARE_DIRECTORY_ALL,
	type ShareFolderNode,
	type ShareRuntimeItem
} from './share-runtime.ts'
import {
	createHomeShareListContract,
	createSharePageState,
	replaceSharePageArtifacts,
	setSharePageCategory,
	setSharePageDirectory,
	setSharePageEditMode,
	setSharePageSearchTerm,
	setSharePageSelectedTag,
	type ShareCategoriesArtifact
} from './share-page-state.ts'

const listArtifact: ShareRuntimeItem[] = [
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
		tags: ['image', 'icon'],
		stars: 4,
		category: 'inspiration',
		folderPath: '/design/images/icons'
	},
	{
		name: 'Beta Motion',
		logo: '/logos/beta.png',
		url: 'https://beta.dev',
		description: 'react animation toolkit',
		tags: ['react', 'motion'],
		stars: 5,
		category: 'tool',
		folderPath: '/dev/frontend'
	},
	{
		name: 'Hidden Archive',
		logo: '/logos/hidden.png',
		url: 'https://hidden.dev',
		description: 'hidden category entry',
		tags: ['archive'],
		stars: 1,
		category: 'hidden',
		folderPath: '/design/images'
	},
	{
		name: 'Gamma Search',
		logo: '/logos/gamma.png',
		url: 'https://gamma.dev',
		description: 'search everything',
		tags: ['search', 'utility'],
		stars: 4
	}
]

const categoriesArtifact: ShareCategoriesArtifact = {
	categories: ['inspiration', 'learning', 'tool', 'unused']
}

const foldersArtifact: ShareFolderNode[] = [
	{
		name: 'design',
		path: '/design',
		children: [
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

function createState(overrides: {
	filters?: Partial<Parameters<typeof createSharePageState>[0]['filters']>
	isEditMode?: boolean
} = {}) {
	return createSharePageState({
		listArtifact,
		categoriesArtifact,
		foldersArtifact,
		filters: overrides.filters,
		isEditMode: overrides.isEditMode
	})
}

describe('share page state', () => {
	it('直接消费 list.json 作为卡片与过滤数据源', () => {
		const state = createState()

		assert.deepEqual(state.artifacts.list, listArtifact)
		assert.deepEqual(
			state.runtime.visibleItems.map(item => item.url),
			listArtifact.map(item => item.url)
		)
	})

	it('目录树直接消费 folders.json', () => {
		const state = createState()

		assert.deepEqual(state.artifacts.folders, foldersArtifact)
		assert.deepEqual(state.runtime.directoryTree, foldersArtifact)
	})

	it('分类 tabs 先消费 categories.json，再按当前目录范围收窄', () => {
		const state = createState({
			filters: {
				activeDirectory: '/design',
				activeCategory: SHARE_CATEGORY_ALL,
				searchTerm: '',
				selectedTag: SHARE_CATEGORY_ALL
			}
		})

		assert.deepEqual(state.artifacts.categories, categoriesArtifact)
		assert.deepEqual(state.runtime.availableCategories, ['all', 'inspiration', 'tool'])
		assert.equal(state.runtime.availableCategories.includes('hidden'), false)
		assert.equal(state.runtime.availableCategories.includes('unused'), false)
	})

	it('目录切换通过 page-state API 归一化分类，并保留 search/tag', () => {
		const initial = createState({
			filters: {
				activeDirectory: '/design',
				activeCategory: 'inspiration',
				searchTerm: 'beta',
				selectedTag: 'react'
			}
		})

		const next = setSharePageDirectory(initial, '/dev')

		assert.deepEqual(next.filters, {
			activeDirectory: '/dev',
			activeCategory: SHARE_CATEGORY_ALL,
			searchTerm: 'beta',
			selectedTag: 'react'
		})
		assert.equal(next.runtime.activeCategory, SHARE_CATEGORY_ALL)
		assert.deepEqual(next.runtime.availableCategories, ['all', 'tool'])
		assert.deepEqual(next.runtime.visibleItems.map(item => item.url), ['https://beta.dev'])
	})

	it('分类切换通过 page-state API 仍受当前目录约束', () => {
		const initial = createState({
			filters: {
				activeDirectory: '/design',
				activeCategory: SHARE_CATEGORY_ALL,
				searchTerm: 'icon',
				selectedTag: 'image'
			}
		})

		const next = setSharePageCategory(initial, 'learning')

		assert.equal(next.filters.activeDirectory, '/design')
		assert.equal(next.filters.activeCategory, SHARE_CATEGORY_ALL)
		assert.equal(next.filters.searchTerm, 'icon')
		assert.equal(next.filters.selectedTag, 'image')
		assert.equal(next.runtime.activeCategory, SHARE_CATEGORY_ALL)
		assert.deepEqual(next.runtime.availableCategories, ['all', 'inspiration', 'tool'])
		assert.deepEqual(next.runtime.visibleItems.map(item => item.url), ['https://icons.dev'])
	})

	it('进入与退出 edit mode 时保持当前 filtered context 与派生 runtime 状态', () => {
		const initial = createState({
			filters: {
				activeDirectory: '/design',
				activeCategory: 'learning',
				searchTerm: '',
				selectedTag: SHARE_CATEGORY_ALL
			}
		})

		const enteringEditMode = setSharePageEditMode(initial, true)
		const exitingEditMode = setSharePageEditMode(enteringEditMode, false)

		assert.deepEqual(exitingEditMode.filters, {
			activeDirectory: '/design',
			activeCategory: 'learning',
			searchTerm: '',
			selectedTag: 'all'
		})
		assert.equal(exitingEditMode.runtime.activeCategory, 'learning')
		assert.deepEqual(exitingEditMode.runtime.visibleItems.map(item => item.url), [])
		assert.deepEqual(enteringEditMode.runtime.availableCategories, ['all', 'inspiration', 'tool'])
		assert.equal(enteringEditMode.runtime.emptyState, 'category-empty')
		assert.deepEqual(exitingEditMode.runtime.availableCategories, ['all', 'inspiration', 'tool'])
		assert.equal(exitingEditMode.runtime.emptyState, 'category-empty')
	})

	it('双栏导航加入后仍保留 search 与 tag UI 状态', () => {
		const state = createState({
			filters: {
				activeDirectory: '/design',
				activeCategory: 'tool',
				searchTerm: 'compress',
				selectedTag: 'image'
			}
		})

		assert.equal(state.filters.searchTerm, 'compress')
		assert.equal(state.filters.selectedTag, 'image')
		assert.deepEqual(state.runtime.visibleItems.map(item => item.url), ['https://alpha.dev'])
	})

	it('search 更新 API 会归一化输入并重建 runtime', () => {
		const initial = createState({
			filters: {
				activeDirectory: '/design',
				activeCategory: 'tool',
				searchTerm: '',
				selectedTag: SHARE_CATEGORY_ALL
			}
		})

		const next = setSharePageSearchTerm(initial, '  compress  ')

		assert.deepEqual(next.filters, {
			activeDirectory: '/design',
			activeCategory: 'tool',
			searchTerm: 'compress',
			selectedTag: SHARE_CATEGORY_ALL
		})
		assert.deepEqual(next.runtime.visibleItems.map(item => item.url), ['https://alpha.dev'])
		assert.equal(next.runtime.emptyState, null)
	})

	it('tag 更新 API 会归一化输入并重建 runtime', () => {
		const initial = createState({
			filters: {
				activeDirectory: '/design',
				activeCategory: SHARE_CATEGORY_ALL,
				searchTerm: 'alpha',
				selectedTag: SHARE_CATEGORY_ALL
			}
		})

		const next = setSharePageSelectedTag(initial, '  icon  ')

		assert.deepEqual(next.filters, {
			activeDirectory: '/design',
			activeCategory: SHARE_CATEGORY_ALL,
			searchTerm: 'alpha',
			selectedTag: 'icon'
		})
		assert.deepEqual(next.runtime.visibleItems.map(item => item.url), ['https://icons.dev'])
		assert.equal(next.runtime.emptyState, null)
	})

	it('artifacts 替换 API 会按新产物重建 runtime 并重新归一化 directory/category', () => {
		const initial = createState({
			filters: {
				activeDirectory: '/design',
				activeCategory: 'inspiration',
				searchTerm: '  beta  ',
				selectedTag: 'react'
			},
			isEditMode: true
		})
		const nextListArtifact: ShareRuntimeItem[] = [
			{
				name: 'Beta Motion',
				logo: '/logos/beta.png',
				url: 'https://beta.dev',
				description: 'react animation toolkit',
				tags: ['react', 'motion'],
				stars: 5,
				category: 'tool',
				folderPath: '/dev/frontend'
			}
		]
		const nextCategoriesArtifact: ShareCategoriesArtifact = {
			categories: ['tool']
		}
		const nextFoldersArtifact: ShareFolderNode[] = [
			{
				name: 'dev',
				path: '/dev',
				children: [{ name: 'frontend', path: '/dev/frontend', children: [] }]
			}
		]

		const next = replaceSharePageArtifacts(initial, {
			listArtifact: nextListArtifact,
			categoriesArtifact: nextCategoriesArtifact,
			foldersArtifact: nextFoldersArtifact
		})

		assert.deepEqual(next.artifacts, {
			list: nextListArtifact,
			categories: nextCategoriesArtifact,
			folders: nextFoldersArtifact
		})
		assert.deepEqual(next.filters, {
			activeDirectory: SHARE_DIRECTORY_ALL,
			activeCategory: SHARE_CATEGORY_ALL,
			searchTerm: 'beta',
			selectedTag: 'react'
		})
		assert.equal(next.isEditMode, true)
		assert.equal(next.runtime.activeCategory, SHARE_CATEGORY_ALL)
		assert.deepEqual(next.runtime.availableCategories, ['all', 'tool'])
		assert.deepEqual(next.runtime.visibleItems.map(item => item.url), ['https://beta.dev'])
	})

	it('初始 state 创建时会把 filters 与 runtime 归一化到同一语义', () => {
		const state = createState({
			filters: {
				activeDirectory: '/missing',
				activeCategory: 'hidden',
				searchTerm: '  alpha  ',
				selectedTag: '   '
			}
		})

		assert.deepEqual(state.filters, {
			activeDirectory: SHARE_DIRECTORY_ALL,
			activeCategory: SHARE_CATEGORY_ALL,
			searchTerm: 'alpha',
			selectedTag: SHARE_CATEGORY_ALL
		})
		assert.equal(state.runtime.activeCategory, SHARE_CATEGORY_ALL)
		assert.deepEqual(state.runtime.visibleItems.map(item => item.url), [
			'https://alpha.dev',
			'https://icons.dev'
		])
	})

	it('为首页 share consumer 预留最小 list passthrough，不作为 Task 2 完成依据', () => {
		const homeList = createHomeShareListContract(listArtifact)

		assert.deepEqual(homeList, listArtifact)
	})

	it('默认 filters 与 page runtime 常量保持一致', () => {
		const state = createState()

		assert.equal(state.filters.activeDirectory, SHARE_DIRECTORY_ALL)
		assert.equal(state.filters.activeCategory, SHARE_CATEGORY_ALL)
		assert.equal(state.filters.searchTerm, '')
		assert.equal(state.filters.selectedTag, SHARE_CATEGORY_ALL)
	})
})
