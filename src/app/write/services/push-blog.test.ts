import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { assertPublishableBlog, buildBlogUpsertItem, buildRemoteArtifactContents, type PushBlogParams } from './push-blog'

describe('assertPublishableBlog', () => {
	it('阻止失效本地图片占位符进入正式发布链路', () => {
		assert.throws(
			() =>
				assertPublishableBlog({
					form: {
						slug: 'post-1',
						title: '标题',
						md: '![lost](local-image:missing-file)',
						tags: []
					},
					images: []
				}),
			/本地文件图片引用已失效/
		)
	})

	it('允许仍有对应文件对象的本地图片占位符发布', () => {
		assert.doesNotThrow(() =>
			assertPublishableBlog({
				form: {
					slug: 'post-1',
					title: '标题',
					md: '![live](local-image:live-file)',
					tags: []
				},
				images: [
					{
						id: 'live-file',
						type: 'file',
						file: { name: 'live.png' } as File,
						previewUrl: 'blob:live-file',
						filename: 'live.png'
					}
				]
			})
		)
	})
})
describe('buildBlogUpsertItem', () => {
	it('将 folderPath 与 favorite 透传到 upsertItem', () => {
		const form: PushBlogParams['form'] = {
			slug: 'post-1',
			title: '标题',
			md: '# hello',
			tags: ['a'],
			date: '2026-03-27T10:00:00.000Z',
			category: '分类A',
			folderPath: '/写作/技术',
			favorite: true
		}

		const item = buildBlogUpsertItem(form, form.date!, '/cover.png')
		assert.equal(item.folderPath, '/写作/技术')
		assert.equal(item.favorite, true)
		assert.equal(item.category, '分类A')
	})
})

describe('buildRemoteArtifactContents', () => {
	it('远端发布应同时生成 index/categories/folders/storage 四个正式产物内容', async () => {
		const form: PushBlogParams['form'] = {
			slug: 'post-1',
			title: '标题',
			md: '# hello',
			tags: ['a'],
			date: '2026-03-27T10:00:00.000Z',
			category: '分类A',
			folderPath: '/写作/技术',
			favorite: true
		}

		const artifacts = await buildRemoteArtifactContents({
			form,
			dateStr: form.date!,
			coverPath: '/cover.png',
			readStorageRaw: async () => null,
			fallbackReadIndexRaw: async () => '[]'
		})

		assert.deepEqual(Object.keys(artifacts).sort(), ['categories', 'folders', 'index', 'storage'])
		assert.equal(JSON.parse(artifacts.index)[0].slug, 'post-1')
		assert.deepEqual(JSON.parse(artifacts.categories).categories, ['分类A'])
		const folders = JSON.parse(artifacts.folders) as Array<{ path: string; children?: Array<{ path: string }> }>
		assert.equal(folders[0].path, '/写作')
		assert.equal(folders[0].children?.[0]?.path, '/写作/技术')
		assert.equal(JSON.parse(artifacts.storage).blogs['post-1'].favorite, true)
	})
})
