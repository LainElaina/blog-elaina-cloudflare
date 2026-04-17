import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
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
	finishShareEditSession,
	mergeEditingSharesIntoVisibleItems,
	replaceSharePageArtifacts,
	resolveShareEditAnchorUrl,
	setSharePageCategory,
	setSharePageDirectory,
	setSharePageEditMode,
	setSharePageSearchTerm,
	setSharePageSelectedTag,
	startShareEditSession,
	type ShareCategoriesArtifact
} from './share-page-state.ts'
import { buildShareRuntimeArtifactsFromList } from './components/share-folder-select-view-model.ts'

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

async function readShareEditingSources() {
	const [pageSource, createDialogSource, shareCardSource, shareFolderSelectSource, pushSharesSource, gridViewSource] = await Promise.all([
		fs.readFile(new URL('./page.tsx', import.meta.url), 'utf-8'),
		fs.readFile(new URL('./components/create-dialog.tsx', import.meta.url), 'utf-8'),
		fs.readFile(new URL('./components/share-card.tsx', import.meta.url), 'utf-8'),
		fs.readFile(new URL('./components/share-folder-select.tsx', import.meta.url), 'utf-8'),
		fs.readFile(new URL('./services/push-shares.ts', import.meta.url), 'utf-8'),
		fs.readFile(new URL('./grid-view.tsx', import.meta.url), 'utf-8')
	])

	return {
		pageSource,
		createDialogSource,
		shareCardSource,
		shareFolderSelectSource,
		pushSharesSource,
		gridViewSource
	}
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

	it('改 URL 的 create 与 inline edit 都会复用统一 URL 归一化 helper', async () => {
		const { createDialogSource, shareCardSource } = await readShareEditingSources()

		assert.match(createDialogSource, /normalizeShareUrlInput/)
		assert.match(shareCardSource, /normalizeShareUrlInput/)
	})

	it('page 当前编辑态会从最新 list 立即回填分类与目录候选', async () => {
		const { pageSource } = await readShareEditingSources()

		assert.match(pageSource, /buildShareRuntimeArtifactsFromList\(/)
	})

	it('share-card 取消 inline edit 会通知 page 回滚本次 session 的 pending 状态', async () => {
		const { pageSource, shareCardSource } = await readShareEditingSources()

		assert.match(shareCardSource, /onCancelEdit\?\.\(/)
		assert.match(pageSource, /const handleCancelShareEdit = \(/)
	})

	it('push-shares 远端发布后回传完整 artifacts，供页面立即回填', async () => {
		const { pageSource, pushSharesSource } = await readShareEditingSources()

		assert.doesNotMatch(pushSharesSource, /Promise<Share\[]>/)
		assert.match(pageSource, /const publishedArtifacts = await pushShares\(/)
		assert.match(pageSource, /nextArtifacts = publishedArtifacts/)
	})

	it('create/edit 源码门禁要求接入 share folder selector，不再保留原始 folderPath 文本输入', async () => {
		const { createDialogSource, shareCardSource, shareFolderSelectSource } = await readShareEditingSources()

		assert.match(createDialogSource, /ShareFolderSelect/)
		assert.match(shareCardSource, /ShareFolderSelect/)
		assert.match(shareFolderSelectSource, /createButtonLabel/)
		assert.doesNotMatch(createDialogSource, /placeholder='\/目录\/子目录（可选）'/)
		assert.doesNotMatch(shareCardSource, /placeholder='\/目录\/子目录（可选）'/)
	})

	it('create/edit -> page 必须显式传递 oldUrl/currentUrl，不能继续依赖 name 推断旧记录', async () => {
		const { pageSource, createDialogSource, shareCardSource, pushSharesSource } = await readShareEditingSources()

		assert.match(createDialogSource, /buildShareEditSubmitPayload/)
		assert.match(createDialogSource, /\boldUrl\b/)
		assert.match(createDialogSource, /\bcurrentUrl\b/)
		assert.match(shareCardSource, /\boldUrl\b/)
		assert.match(shareCardSource, /\bcurrentUrl\b/)
		assert.match(pageSource, /payload\.oldUrl/)
		assert.match(pageSource, /payload\.currentUrl/)
		assert.match(pushSharesSource, /urlMappings/)
		assert.doesNotMatch(pushSharesSource, /item => item\.name === share\.name/)
	})

	it('改 URL 并更换 logo 的同次编辑需要把 create-dialog pending logoItems 迁移到新 URL key', async () => {
		const { pageSource, createDialogSource } = await readShareEditingSources()

		assert.match(createDialogSource, /logoItem/)
		assert.match(pageSource, /migratePendingShareLogoItems/)
		assert.match(pageSource, /payload\.logoItem/)
	})

	it('分类字段仍由 create/edit 显式透传', async () => {
		const { createDialogSource, shareCardSource } = await readShareEditingSources()

		assert.match(createDialogSource, /formData\.category/)
		assert.match(shareCardSource, /handleFieldChange\('category'/)
	})

	it('push-shares 远端链路改为消费显式 URL 映射合同', async () => {
		const { pushSharesSource } = await readShareEditingSources()

		assert.match(pushSharesSource, /type ShareUrlMapping/)
		assert.match(pushSharesSource, /urlMappings \?\? \[\]/)
	})

	it('page 保存本地产物时继续沿用 pending URL 映射生成 storage payload', async () => {
		const { pageSource } = await readShareEditingSources()

		assert.match(pageSource, /buildLocalShareSaveFilePayloads\(updatedShares, existingStorageRaw, renamedUrls, deletedPublishedUrls\)/)
	})

	it('page 不再通过名称推断 rename 来源', async () => {
		const { pageSource } = await readShareEditingSources()

		assert.doesNotMatch(pageSource, /find\(item => item\.name === share\.name\)/)
	})

	it('page 仍保留 folderPath 编辑字段接线', async () => {
		const { createDialogSource, shareCardSource } = await readShareEditingSources()

		assert.match(createDialogSource, /folderPath/)
		assert.match(shareCardSource, /folderPath/)
	})

	it('page 通过统一 helper 迁移 inline edit 的 logoItems key', async () => {
		const { pageSource } = await readShareEditingSources()

		assert.match(pageSource, /migratePendingShareLogoItems\(new Map\(prev\)/)
	})

	it('page 通过统一 helper 维护 pending oldUrl/currentUrl 映射', async () => {
		const { pageSource } = await readShareEditingSources()

		assert.match(pageSource, /updatePendingShareUrlMappings\(new Map\(prev\)/)
	})

	it('page create-dialog 保存链路会清空 editingShare', async () => {
		const { pageSource } = await readShareEditingSources()

		assert.match(pageSource, /setEditingShare\(null\)/)
	})

	it('page create-dialog 保存链路会接收 payload 对象', async () => {
		const { pageSource } = await readShareEditingSources()

		assert.match(pageSource, /const handleSaveShare = \(payload:/)
	})

	it('page 远端发布链路直接传递 urlMappings 给 push-shares', async () => {
		const { pageSource } = await readShareEditingSources()

		assert.match(pageSource, /urlMappings: Array\.from\(renamedUrls\.entries\(\)\)/)
	})

	it('page create-dialog 保存链路会迁移 pending logoItems', async () => {
		const { pageSource } = await readShareEditingSources()

		assert.match(pageSource, /migratePendingShareLogoItems\(new Map\(prev\), \{\s*oldUrl: payload\.oldUrl/s)
	})

	it('page inline edit 链路也继续显式透传 oldUrl/currentUrl', async () => {
		const { pageSource, shareCardSource } = await readShareEditingSources()

		assert.match(shareCardSource, /onUpdate\?\.\(updated, share, nextLogoItem, oldUrl, currentUrl\)/)
		assert.match(pageSource, /const handleUpdate = \(updatedShare: Share, oldShare: Share, logoItem\?: LogoItem, oldUrl = oldShare\.url, currentUrl = updatedShare\.url\)/)
	})

	it('改 URL 并更换 logo 的同次编辑不会保留 oldUrl logo key', async () => {
		const { pageSource } = await readShareEditingSources()

		assert.match(pageSource, /next\.delete\(oldUrl\)/)
	})

	it('share folder selector 源码保留新建目录输入入口', async () => {
		const { shareFolderSelectSource } = await readShareEditingSources()

		assert.match(shareFolderSelectSource, /createdFolderInput/)
		assert.match(shareFolderSelectSource, /确认目录/)
	})

	it('create-dialog logo 选择后不会只更新表单 URL，还会保留待提交 logoItem', async () => {
		const { createDialogSource } = await readShareEditingSources()

		assert.match(createDialogSource, /setLogoItem/)
	})

	it('share-card 目录编辑改为 selector 组件 onChange 驱动', async () => {
		const { shareCardSource } = await readShareEditingSources()

		assert.match(shareCardSource, /onChange=\{value => handleFieldChange\('folderPath', value\)\}/)
	})

	it('create-dialog 目录编辑改为 selector 组件 onChange 驱动', async () => {
		const { createDialogSource } = await readShareEditingSources()

		assert.match(createDialogSource, /onChange=\{value => setFormData\(current => \(\{ \.\.\.current, folderPath: value \}\)\)\}/)
	})

	it('远端发布链路继续根据显式映射生成 renamedUrls map', async () => {
		const { pushSharesSource } = await readShareEditingSources()

		assert.match(pushSharesSource, /renamedUrls\.set\(mapping\.currentUrl, mapping\.oldUrl\)/)
	})

	it('page create-dialog 保存链路会把 logoItem 一起交给 helper', async () => {
		const { pageSource } = await readShareEditingSources()

		assert.match(pageSource, /logoItem: payload\.logoItem/)
	})

	it('create-dialog 提交前会归一化 folderPath', async () => {
		const { createDialogSource } = await readShareEditingSources()

		assert.match(createDialogSource, /normalizeShareFolderPathInput/)
	})

	it('share-card 编辑时会归一化 folderPath', async () => {
		const { shareCardSource } = await readShareEditingSources()

		assert.match(shareCardSource, /normalizeShareFolderPathInput/)
	})

	it('改 URL 并更换 logo 的同次编辑需要把 pending logoItems 迁移到新 URL key', async () => {
		const { pageSource } = await readShareEditingSources()

		assert.match(pageSource, /currentUrl/)
		assert.match(pageSource, /payload\.logoItem|logoItem/)
	})

	it('当前编辑中的 share 即使暂时移出当前过滤范围，也仍能保留在当前视图里', () => {
		const initial = createState({
			filters: {
				activeDirectory: '/design',
				activeCategory: 'tool',
				searchTerm: '',
				selectedTag: SHARE_CATEGORY_ALL
			},
			isEditMode: true
		})
		const movedAlphaList = listArtifact.map(item =>
			item.url === 'https://alpha.dev'
				? {
					...item,
					folderPath: '/dev/frontend'
				}
				: item
		)
		const movedArtifacts = buildShareRuntimeArtifactsFromList(movedAlphaList)
		const next = replaceSharePageArtifacts(initial, {
			listArtifact: movedAlphaList,
			categoriesArtifact: movedArtifacts.categories,
			foldersArtifact: movedArtifacts.folders
		})

		assert.deepEqual(next.runtime.visibleItems.map(item => item.url), [])
		assert.deepEqual(
			mergeEditingSharesIntoVisibleItems({
				visibleItems: next.runtime.visibleItems,
				allItems: next.artifacts.list,
				editingAnchorUrls: ['https://alpha.dev']
			}).map(item => item.url),
			['https://alpha.dev']
		)
	})

	it('改 URL 后仍能通过 old URL anchor 找回当前编辑中的 share', () => {
		const renamedUrls = new Map([['https://alpha-next.dev', 'https://alpha.dev']])
		const renamedAlphaList = listArtifact.map(item =>
			item.url === 'https://alpha.dev'
				? {
					...item,
					url: 'https://alpha-next.dev'
				}
				: item
		)

		assert.equal(resolveShareEditAnchorUrl('https://alpha-next.dev', renamedUrls), 'https://alpha.dev')
		assert.deepEqual(
			mergeEditingSharesIntoVisibleItems({
				visibleItems: [],
				allItems: renamedAlphaList,
				editingAnchorUrls: ['https://alpha.dev'],
				renamedUrls
			}).map(item => item.url),
			['https://alpha-next.dev']
		)
	})

	it('rename 后再次进入编辑也会继续记录 canonical anchor', () => {
		const renamedUrls = new Map([['https://alpha-next.dev', 'https://alpha.dev']])

		assert.deepEqual(startShareEditSession([], 'https://alpha-next.dev', renamedUrls), ['https://alpha.dev'])
		assert.deepEqual(finishShareEditSession(['https://alpha.dev'], 'https://alpha-next.dev', renamedUrls), [])
	})

	it('二次改 URL 结束编辑时也会按最新 draft URL 清理 canonical anchor', () => {
		const started = startShareEditSession([], 'https://alpha-next.dev', new Map([['https://alpha-next.dev', 'https://alpha.dev']]))

		assert.deepEqual(
			finishShareEditSession(started, 'https://alpha-final.dev', new Map([['https://alpha-final.dev', 'https://alpha.dev']])),
			[]
		)
	})

	it('replace artifacts 时可保留当前目录/分类上下文，避免编辑中途跳回 all', () => {
		const initial = createState({
			filters: {
				activeDirectory: '/design',
				activeCategory: 'tool',
				searchTerm: '',
				selectedTag: SHARE_CATEGORY_ALL
			},
			isEditMode: true
		})
		const movedAlphaList = listArtifact.map(item =>
			item.url === 'https://alpha.dev'
				? {
					...item,
					folderPath: '/dev/frontend'
				}
				: item
		)
		const movedArtifacts = buildShareRuntimeArtifactsFromList(movedAlphaList)
		const next = replaceSharePageArtifacts(
			initial,
			{
				listArtifact: movedAlphaList,
				categoriesArtifact: movedArtifacts.categories,
				foldersArtifact: movedArtifacts.folders
			},
			{ preserveFilters: true }
		)

		assert.equal(next.filters.activeDirectory, '/design')
		assert.equal(next.filters.activeCategory, 'tool')
		assert.equal(next.runtime.emptyState, 'category-empty')
	})

	it('当前目录节点被本次编辑整体搬空时，仍保留原目录/分类上下文', () => {
		const singleScopedState = createSharePageState({
			listArtifact: [listArtifact[0]],
			categoriesArtifact: { categories: ['tool'] },
			foldersArtifact: [
				{
					name: 'design',
					path: '/design',
					children: [{ name: 'images', path: '/design/images', children: [] }]
				}
			],
			filters: {
				activeDirectory: '/design',
				activeCategory: 'tool',
				searchTerm: '',
				selectedTag: SHARE_CATEGORY_ALL
			},
			isEditMode: true
		})
		const movedList = [
			{
				...listArtifact[0],
				folderPath: '/dev/frontend'
			}
		]
		const movedArtifacts = buildShareRuntimeArtifactsFromList(movedList)
		const next = replaceSharePageArtifacts(
			singleScopedState,
			{
				listArtifact: movedList,
				categoriesArtifact: movedArtifacts.categories,
				foldersArtifact: movedArtifacts.folders
			},
			{ preserveFilters: true }
		)

		assert.equal(next.filters.activeDirectory, '/design')
		assert.equal(next.runtime.activeCategory, 'tool')
		assert.equal(next.runtime.emptyState, 'directory-empty')
	})

	it('page 退出 edit mode 时会让 share-card 清掉本地编辑 session', async () => {
		const { shareCardSource } = await readShareEditingSources()

		assert.match(shareCardSource, /useEffect\(\(\) => \{[\s\S]*?!isEditMode/)
		assert.match(shareCardSource, /setIsEditing\(false\)/)
		assert.match(shareCardSource, /setEditSessionOriginal\(null\)/)
	})

	it('page 会把当前 editing anchor 传给可见卡片合并逻辑', async () => {
		const { pageSource } = await readShareEditingSources()

		assert.match(pageSource, /mergeEditingSharesIntoVisibleItems\(/)
		assert.match(pageSource, /editingAnchorUrls/)
	})

	it('draft-only 改 URL 时仍会为卡片提供稳定 key', async () => {
		const { pageSource } = await readShareEditingSources()

		assert.match(pageSource, /draftOnlyUrls/)
		assert.match(pageSource, /const getShareKey = \(share: Share\)/)
	})

	it('draft-only 取消编辑不会写入伪 renamedUrls 映射', async () => {
		const { pageSource } = await readShareEditingSources()

		assert.match(pageSource, /if \(!prev\.has\(params\.draftShare\.url\)\)/)
	})

	it('grid-view 不再只用 share.url 作为编辑态 key', async () => {
		const { gridViewSource } = await readShareEditingSources()

		assert.doesNotMatch(gridViewSource, /key=\{share\.url\}/)
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
