import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	assertPendingShareUrlAvailable,
	buildShareEditSubmitPayload,
	buildShareFolderSelectViewModel,
	buildShareRuntimeArtifactsFromList,
	collectShareFolderPaths,
	migratePendingShareLogoItems,
	normalizeShareCategoryInput,
	normalizeShareFolderPathInput,
	normalizeShareUrlInput,
	updatePendingShareUrlMappings
} from './share-folder-select-view-model.ts'
import type { ShareFolderNode } from '../share-runtime.ts'

const folderTree: ShareFolderNode[] = [
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

describe('share-folder-select view model', () => {
	it('没有目录时显示空提示与新建按钮文案', () => {
		const view = buildShareFolderSelectViewModel({ folders: [], value: '' })
		assert.equal(view.emptyMessage, '暂无目录，请先新建目录')
		assert.equal(view.createButtonLabel, '新建目录')
		assert.deepEqual(view.options, [{ value: '', label: '默认目录' }])
	})

	it('新建目录会按 blog 规则归一化路径并加入选项', () => {
		const view = buildShareFolderSelectViewModel({
			folders: ['/生活'],
			value: '',
			createdFolderInput: '  设计//图片工具/  '
		})

		assert.equal(view.nextValueAfterCreate, '/设计/图片工具')
		assert.equal(
			view.options.some(option => option.value === '/设计/图片工具'),
			true
		)
	})

	it('创建完成且输入已清空后，未刷新的目录列表里仍保留当前选中目录', () => {
		const creatingView = buildShareFolderSelectViewModel({
			folders: ['/生活'],
			value: '',
			createdFolderInput: '设计/图片工具'
		})
		const selectedValue = creatingView.nextValueAfterCreate ?? ''

		const createdView = buildShareFolderSelectViewModel({
			folders: ['/生活'],
			value: selectedValue
		})
		assert.equal(
			createdView.options.some(option => option.value === '/设计/图片工具'),
			true
		)
	})

	it('从目录树收集 selector 选项时保留层级顺序', () => {
		assert.deepEqual(collectShareFolderPaths(folderTree), [
			'/design',
			'/design/images',
			'/design/images/icons',
			'/dev',
			'/dev/frontend'
		])
	})

	it('从当前 list 可立即派生分类与目录产物，供当前编辑态候选回填', () => {
		const artifacts = buildShareRuntimeArtifactsFromList([
			{
				name: 'Design Tool',
				logo: '/logos/design.png',
				url: 'https://design.example',
				description: 'design helper',
				tags: ['design'],
				stars: 4,
				category: '  设计工具  ',
				folderPath: '  设计//图片工具  '
			},
			{
				name: 'Dev Tool',
				logo: '/logos/dev.png',
				url: 'https://dev.example',
				description: 'dev helper',
				tags: ['dev'],
				stars: 5,
				category: '开发',
				folderPath: '/开发/前端'
			}
		])

		assert.deepEqual(artifacts.categories, { categories: ['开发', '设计工具'] })
		assert.deepEqual(collectShareFolderPaths(artifacts.folders), ['/开发', '/开发/前端', '/设计', '/设计/图片工具'])
	})

	it('create/edit 提交会显式携带 canonical oldUrl/currentUrl 合同', () => {
		const payload = buildShareEditSubmitPayload({
			share: { url: ' https://new.example/path ', name: 'New Share' },
			oldUrl: ' https://old.example/path ',
			logoItem: { kind: 'new-logo' }
		})

		assert.deepEqual(payload, {
			share: { url: 'https://new.example/path', name: 'New Share' },
			oldUrl: 'https://old.example/path',
			currentUrl: 'https://new.example/path',
			logoItem: { kind: 'new-logo' }
		})
	})

	it('URL 输入会统一归一化为 trim 后的 canonical form', () => {
		assert.equal(normalizeShareUrlInput(' https://example.com/share '), 'https://example.com/share')
		assert.equal(normalizeShareUrlInput('   '), '')
	})

	it('改 URL 时会把 pending rename 映射串联到当前 URL', () => {
		const pending = new Map<string, string>([['https://draft.example', 'https://origin.example']])

		const next = updatePendingShareUrlMappings(pending, {
			oldUrl: 'https://draft.example',
			currentUrl: 'https://final.example'
		})

		assert.deepEqual(Array.from(next.entries()), [['https://final.example', 'https://origin.example']])
	})

	it('改 URL 并换 logo 时会把 pending logoItems 锁到 currentUrl key', () => {
		const pending = new Map<string, { kind: string }>([['https://old.example', { kind: 'old-logo' }]])

		const next = migratePendingShareLogoItems(pending, {
			oldUrl: 'https://old.example',
			currentUrl: 'https://new.example',
			logoItem: { kind: 'new-logo' }
		})

		assert.deepEqual(Array.from(next.entries()), [['https://new.example', { kind: 'new-logo' }]])
	})

	it('编辑时改成当前列表已占用 URL 会失败', () => {
		assert.throws(
			() =>
				assertPendingShareUrlAvailable({
					currentUrl: 'https://beta.dev',
					oldUrl: 'https://alpha.dev',
					shares: [{ url: 'https://alpha.dev' }, { url: 'https://beta.dev' }],
					renamedUrls: new Map(),
					deletedPublishedUrls: new Set()
				}),
			/URL 已存在/
		)
	})

	it('同 session 内不能复用 pending rename 腾出的旧 URL', () => {
		assert.throws(
			() =>
				assertPendingShareUrlAvailable({
					currentUrl: 'https://alpha.dev',
					shares: [{ url: 'https://beta.dev' }],
					renamedUrls: new Map([['https://beta.dev', 'https://alpha.dev']]),
					deletedPublishedUrls: new Set()
				}),
			/URL 已存在/
		)
	})

	it('同 session 内不能复用已删除 published URL', () => {
		assert.throws(
			() =>
				assertPendingShareUrlAvailable({
					currentUrl: 'https://beta.dev',
					shares: [{ url: 'https://alpha.dev' }],
					renamedUrls: new Map(),
					deletedPublishedUrls: new Set(['https://beta.dev'])
				}),
			/URL 已存在/
		)
	})

	it('本次会话中新建 draft 改 URL 后仍可复用旧 draft URL', () => {
		assert.equal(
			assertPendingShareUrlAvailable({
				currentUrl: 'https://draft-a.dev',
				shares: [{ url: 'https://final-a.dev' }],
				renamedUrls: new Map([['https://final-a.dev', 'https://draft-a.dev']]),
				deletedPublishedUrls: new Set(),
				draftOnlyUrls: new Set(['https://draft-a.dev'])
			}),
			undefined
		)
	})

	it('本次会话中新建后删除的 draft URL 仍可复用', () => {
		assert.equal(
			assertPendingShareUrlAvailable({
				currentUrl: 'https://draft-b.dev',
				shares: [],
				renamedUrls: new Map(),
				deletedPublishedUrls: new Set(['https://draft-b.dev']),
				draftOnlyUrls: new Set(['https://draft-b.dev'])
			}),
			undefined
		)
	})

	it('未冲突的新 URL 仍允许通过', () => {
		assert.equal(
			assertPendingShareUrlAvailable({
				currentUrl: 'https://gamma.dev',
				oldUrl: 'https://alpha.dev',
				shares: [{ url: 'https://alpha.dev' }, { url: 'https://beta.dev' }],
				renamedUrls: new Map(),
				deletedPublishedUrls: new Set()
			}),
			undefined
		)
	})

	it('分类空白输入会归一化为 undefined', () => {
		assert.equal(normalizeShareCategoryInput('   '), undefined)
		assert.equal(normalizeShareCategoryInput(' 工具 '), '工具')
	})

	it('目录空白输入会归一化为 undefined', () => {
		assert.equal(normalizeShareFolderPathInput('   '), undefined)
		assert.equal(normalizeShareFolderPathInput('  设计//图片工具  '), '/设计/图片工具')
	})
})
