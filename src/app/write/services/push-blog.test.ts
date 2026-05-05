import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { describe, it } from 'node:test'

import { assertCreateBlogSlugAvailable, assertPublishableBlog, buildBlogUpsertItem, buildRemoteArtifactContents, buildUnusedBlogImageDeleteTreeItems, hasExistingBlogSlug, type PushBlogParams } from './push-blog'

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
describe('create blog slug availability', () => {
	it('识别 storage 与 index 中已存在的 slug', () => {
		assert.equal(
			hasExistingBlogSlug({
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
			hasExistingBlogSlug({
				slug: 'post-2',
				storageRaw: null,
				indexRaw: JSON.stringify([{ slug: 'post-2', title: '标题', tags: [], date: '2026-03-27T10:00:00.000Z' }])
			}),
			true
		)
		assert.equal(hasExistingBlogSlug({ slug: 'post-3', storageRaw: null, indexRaw: '[]' }), false)
	})

	it('创建模式发现既有文章文件或元数据时应阻止发布', () => {
		assert.throws(
			() => assertCreateBlogSlugAvailable({ slug: 'post-1', storageRaw: null, indexRaw: null, hasExistingFiles: true }),
			/slug 已存在/
		)
		assert.throws(
			() =>
				assertCreateBlogSlugAvailable({
					slug: 'post-2',
					storageRaw: null,
					indexRaw: JSON.stringify([{ slug: 'post-2', title: '标题', tags: [], date: '2026-03-27T10:00:00.000Z' }])
				}),
			/slug 已存在/
		)
		assert.doesNotThrow(() => assertCreateBlogSlugAvailable({ slug: 'post-3', storageRaw: null, indexRaw: '[]', hasExistingFiles: false }))
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

describe('pushBlog create slug checks', () => {
	it('远端创建模式应在上传图片和创建文件前检查重复 slug', async () => {
		const source = (await fs.readFile(new URL('./push-blog.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')
		const checkIndex = source.indexOf("if (mode === 'create')")
		const uploadIndex = source.indexOf("toast.info('正在上传图片...')")
		const createFileIndex = source.indexOf("toast.info('正在创建文件...')")

		assert.notEqual(checkIndex, -1)
		assert.notEqual(uploadIndex, -1)
		assert.notEqual(createFileIndex, -1)
		assert.ok(checkIndex < uploadIndex)
		assert.ok(checkIndex < createFileIndex)
		assert.match(source, /listRepoFilesRecursive\([\s\S]*?basePath,[^\n]*latestCommitSha\)/)
		assert.match(source, /assertCreateBlogSlugAvailable\(\{\n\s*slug: form\.slug,\n\s*storageRaw,\n\s*indexRaw,\n\s*hasExistingFiles: existingFiles\.length > 0\n\s*\}\)/)
		assert.match(source, /readStorageRaw: async \(\) => storageRaw/)
		assert.match(source, /fallbackReadIndexRaw: async \(\) => indexRaw/)
	})

	it('远端编辑模式应在创建文件树前清理未引用的旧图片', async () => {
		const source = (await fs.readFile(new URL('./push-blog.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')
		const cleanupIndex = source.indexOf("if (mode === 'edit')")
		const createTreeIndex = source.indexOf("toast.info('正在创建文件树...')")

		assert.notEqual(cleanupIndex, -1)
		assert.notEqual(createTreeIndex, -1)
		assert.ok(cleanupIndex < createTreeIndex)
		assert.match(source, /const existingRepoFiles = await listRepoFilesRecursive\([\s\S]*?basePath,[^\n]*latestCommitSha\)/)
		assert.match(source, /buildUnusedBlogImageDeleteTreeItems\(\{\n\s*slug: form\.slug,\n\s*existingRepoFiles,\n\s*markdown: mdToUpload,\n\s*coverPath,\n\s*protectedRepoPaths: new Set\(treeItems\.map\(item => item\.path\)\)\n\s*\}\)/)
	})

	it('本地创建模式应在图片上传前检查重复 slug', async () => {
		const source = (await fs.readFile(new URL('../hooks/use-publish.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')
		const checkIndex = source.indexOf("if (mode === 'create')")
		const uploadIndex = source.indexOf('await uploadLocalBlogPublishImage')

		assert.notEqual(checkIndex, -1)
		assert.notEqual(uploadIndex, -1)
		assert.ok(checkIndex < uploadIndex)
		assert.match(source, /fetch\(`\/blogs\/\$\{form\.slug\}\/index\.md`, \{ cache: 'no-store' \}\)/)
		assert.match(source, /fetch\(`\/blogs\/\$\{form\.slug\}\/config\.json`, \{ cache: 'no-store' \}\)/)
		assert.match(source, /assertCreateBlogSlugAvailable\(\{\n\s*slug: form\.slug,\n\s*storageRaw: storageResponse\.ok \? await storageResponse\.text\(\) : null,\n\s*indexRaw: indexResponse\.ok \? await indexResponse\.text\(\) : null,\n\s*hasExistingFiles: mdResponse\.ok \|\| configResponse\.ok\n\s*\}\)/)
	})

	it('本地编辑模式应在保存后清理未引用的旧图片', async () => {
		const source = (await fs.readFile(new URL('../hooks/use-publish.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')
		const readPreviousIndex = source.indexOf('previousImageState = await readPreviousLocalBlogImageState(form.slug)')
		const savePayloadIndex = source.indexOf("await saveLocalBlogPublishFile(payload, '保存索引产物', writtenFiles)")
		const cleanupIndex = source.indexOf('await cleanupUnusedLocalBlogImages(')
		const snapshotIndex = source.indexOf('return buildPublishedWriteSnapshot')

		assert.notEqual(readPreviousIndex, -1)
		assert.notEqual(savePayloadIndex, -1)
		assert.notEqual(cleanupIndex, -1)
		assert.notEqual(snapshotIndex, -1)
		assert.ok(readPreviousIndex < savePayloadIndex)
		assert.ok(savePayloadIndex < cleanupIndex)
		assert.ok(cleanupIndex < snapshotIndex)
		assert.match(source, /function buildLocalUnusedBlogImagePaths\(params: \{[\s\S]*?const previousRepoPaths = collectBlogImageRepoPaths\(\{[\s\S]*?previousMarkdown[\s\S]*?previousCoverPath[\s\S]*?return buildUnusedBlogImageDeleteTreeItems\(\{[\s\S]*?existingRepoFiles: Array\.from\(previousRepoPaths\),[\s\S]*?markdown: params\.markdown,[\s\S]*?protectedRepoPaths: params\.protectedRepoPaths[\s\S]*?\}\)\.map\(item => item\.path\)/)
		assert.match(source, /const filePath = `\$\{basePath\}\/\$\{filename\}`\n\s*protectedRepoPaths\.add\(filePath\)\n\s*await uploadLocalBlogPublishImage/)
		assert.match(source, /if \(mode === 'edit' && previousImageState\) \{\n\s*await cleanupUnusedLocalBlogImages\(\n\s*buildLocalUnusedBlogImagePaths\(\{\n\s*slug: form\.slug,\n\s*previousMarkdown: previousImageState\.markdown,\n\s*previousCoverPath: previousImageState\.coverPath,\n\s*markdown: mdToUpload,\n\s*coverPath,\n\s*protectedRepoPaths\n\s*\}\)\n\s*\)\n\s*\}/)
		assert.match(source, /fetch\('\/api\/delete-image', \{\n\s*method: 'POST',[\s\S]*?body: JSON\.stringify\(\{ path \}\)/)
	})
})

describe('buildUnusedBlogImageDeleteTreeItems', () => {
	it('编辑远端文章时只删除当前正文与封面不再引用的安全旧图片', () => {
		const deleteItems = buildUnusedBlogImageDeleteTreeItems({
			slug: 'post-a',
			existingRepoFiles: [
				'public/blogs/post-a/index.md',
				'public/blogs/post-a/config.json',
				'public/blogs/post-a/old.png',
				'public/blogs/post-a/keep.png',
				'public/blogs/post-a/cover.jpg',
				'public/blogs/post-a/new.webp',
				'public/blogs/post-a/nested/evil.png',
				'public/blogs/post-a/unsafe..png',
				'public/blogs/other/old.png'
			],
			markdown: '![keep](/blogs/post-a/keep.png?version=1)',
			coverPath: '/blogs/post-a/cover.jpg#hash',
			protectedRepoPaths: new Set(['public/blogs/post-a/new.webp'])
		})

		assert.deepEqual(deleteItems, [
			{
				path: 'public/blogs/post-a/old.png',
				mode: '100644',
				type: 'blob',
				sha: null
			}
		])
	})
})

describe('pushBlog image upload de-duplication', () => {
	it('同文件名图片应复用首次上传的实际路径，且不同扩展名不能混用', async () => {
		const source = (await fs.readFile(new URL('./push-blog.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

		assert.match(source, /const uploadedImagePaths = new Map<string, string>\(\)/)
		assert.match(source, /const publicPath = `\/blogs\/\$\{form\.slug\}\/\$\{filename\}`\n\s*const uploadKey = filename/)
		assert.match(source, /if \(!uploadedImagePaths\.has\(uploadKey\)\) \{[\s\S]*?uploadedImagePaths\.set\(uploadKey, publicPath\)[\s\S]*?\}/)
		assert.match(source, /const uploadedPath = uploadedImagePaths\.get\(uploadKey\)!\n\s*placeholderReplacements\.set\(id, uploadedPath\)\n\s*imagePaths\.set\(id, uploadedPath\)/)
		assert.match(source, /coverPath = uploadedPath/)
		assert.doesNotMatch(source, /uploadedImagePaths\.has\(hash\)/)
		assert.doesNotMatch(source, /uploadedImagePaths\.set\(hash, publicPath\)/)
	})
})
