import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import { registerHooks } from 'node:module'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import type { PushBlogParams } from './push-blog.ts'

const srcRootUrl = new URL('../../../', import.meta.url)

function resolveProjectModule(baseUrl: URL, specifier: string) {
	const directUrl = new URL(specifier, baseUrl)
	if (existsSync(fileURLToPath(directUrl))) {
		return directUrl.href
	}

	for (const extension of ['.ts', '.tsx', '.js', '.jsx', '.json']) {
		const url = new URL(`${specifier}${extension}`, baseUrl)
		if (existsSync(fileURLToPath(url))) {
			return url.href
		}
	}

	return null
}

registerHooks({
	resolve(specifier, context, nextResolve) {
		if (specifier === 'sonner') {
			return {
				shortCircuit: true,
				url: 'data:text/javascript,export const toast = { info: () => undefined }'
			}
		}

		if (specifier === '@/config/site-content.json') {
			return {
				shortCircuit: true,
				url: 'data:text/javascript,export default {}'
			}
		}

		if (context.parentURL && specifier.endsWith('site-content.json')) {
			const directUrl = new URL(specifier, context.parentURL)
			if (fileURLToPath(directUrl).endsWith('/src/config/site-content.json')) {
				return {
					shortCircuit: true,
					url: 'data:text/javascript,export default {}'
				}
			}
		}

		if (specifier.startsWith('@/')) {
			const url = resolveProjectModule(srcRootUrl, specifier.slice(2))
			if (url) return { shortCircuit: true, url }
		}

		if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL) {
			const url = resolveProjectModule(new URL(context.parentURL), specifier)
			if (url) return { shortCircuit: true, url }
		}

		return nextResolve(specifier, context)
	}
})

const {
	assertCreateBlogSlugAvailable,
	assertAllowedPublishImageFile,
	assertPublishableBlog,
	buildBlogUpsertItem,
	buildRemoteArtifactContents,
	buildUnusedBlogImageDeleteTreeItems,
	hasExistingBlogSlug
} = await import('./push-blog.ts')

describe('assertAllowedPublishImageFile', () => {
	it('远端发布拒绝扩展名与内容不匹配的图片', async () => {
		await assert.rejects(
			() => assertAllowedPublishImageFile(new File(['not image'], 'fake.png', { type: 'image/png' }), '.png'),
			/图片内容与文件类型不匹配/
		)
	})

	it('远端发布拒绝未允许的图片扩展名', async () => {
		await assert.rejects(
			() => assertAllowedPublishImageFile(new File([Buffer.from([0xff, 0xd8, 0xff])], 'fake.bmp', { type: 'image/bmp' }), '.bmp'),
			/不允许的图片文件类型/
		)
	})

	it('远端发布允许签名正确的图片', async () => {
		await assert.doesNotReject(() =>
			assertAllowedPublishImageFile(new File([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], 'ok.png', { type: 'image/png' }), '.png')
		)
	})
})

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
		assert.throws(() => assertCreateBlogSlugAvailable({ slug: 'post-1', storageRaw: null, indexRaw: null, hasExistingFiles: true }), /slug 已存在/)
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

	it('storage 或 legacy index 损坏时拒绝判断 slug 可用性', () => {
		assert.throws(
			() => hasExistingBlogSlug({ slug: 'post-1', storageRaw: '{bad json', indexRaw: null }),
			/博客 storage\.json 解析失败/
		)
		assert.throws(
			() => hasExistingBlogSlug({ slug: 'post-1', storageRaw: null, indexRaw: '{bad json' }),
			/博客 index\.json 解析失败/
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
		assert.match(
			source,
			/assertCreateBlogSlugAvailable\(\{\n\s*slug: form\.slug,\n\s*storageRaw,\n\s*indexRaw,\n\s*hasExistingFiles: existingFiles\.length > 0\n\s*\}\)/
		)
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
		assert.match(
			source,
			/buildUnusedBlogImageDeleteTreeItems\(\{\n\s*slug: form\.slug,\n\s*existingRepoFiles,\n\s*markdown: mdToUpload,\n\s*coverPath,\n\s*protectedRepoPaths: new Set\(treeItems\.map\(item => item\.path\)\)\n\s*\}\)/
		)
	})

	it('远端发布应在创建任何 blob 前完成最终产物构建', async () => {
		const source = (await fs.readFile(new URL('./push-blog.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')
		const artifactIndex = source.indexOf('const artifactContents = await buildRemoteArtifactContents')
		const firstBlobIndex = source.indexOf('await createBlob')
		const uploadToastIndex = source.indexOf("toast.info('正在上传图片...')")
		const createFileToastIndex = source.indexOf("toast.info('正在创建文件...')")

		assert.notEqual(artifactIndex, -1)
		assert.notEqual(firstBlobIndex, -1)
		assert.notEqual(uploadToastIndex, -1)
		assert.notEqual(createFileToastIndex, -1)
		assert.ok(artifactIndex < firstBlobIndex)
		assert.ok(artifactIndex < uploadToastIndex)
		assert.ok(artifactIndex < createFileToastIndex)
		assert.match(source, /const plannedImageUploads = new Map<string, \{ path: string; img: Extract<ImageItem, \{ type: 'file' \}> \}>\(\)/)
	})

	it('远端发布应在计算 hash 和创建 blob 前校验本地图片内容', async () => {
		const source = (await fs.readFile(new URL('./push-blog.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')
		const extensionIndex = source.indexOf('const ext = getImageFileExtension(img.file.name)')
		const validationIndex = source.indexOf('await assertAllowedPublishImageFile(img.file, ext)')
		const hashIndex = source.indexOf('await hashFileSHA256(img.file)')
		const uploadToastIndex = source.indexOf("toast.info('正在上传图片...')")
		const firstBlobIndex = source.indexOf('await createBlob')

		assert.notEqual(extensionIndex, -1)
		assert.notEqual(validationIndex, -1)
		assert.notEqual(hashIndex, -1)
		assert.notEqual(uploadToastIndex, -1)
		assert.notEqual(firstBlobIndex, -1)
		assert.ok(extensionIndex < validationIndex)
		assert.ok(validationIndex < hashIndex)
		assert.ok(validationIndex < uploadToastIndex)
		assert.ok(validationIndex < firstBlobIndex)
		assert.match(source, /import \{ assertAllowedImageFile, getImageFileExtension \} from '@\/lib\/image-content-validation'/)
		assert.doesNotMatch(source, /getFileExt\(img\.file\.name\)/)
	})

	it('远端发布遇到分支并发更新时会重跑完整发布流程一次', async () => {
		const source = (await fs.readFile(new URL('./push-blog.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')
		const attemptStart = source.indexOf('async function attemptPushBlog(): Promise<WriteSafetySnapshot>')
		const retryIndex = source.indexOf('if (isGitHubUpdateRefConflictError(error))')
		const refIndex = source.indexOf('const refData = await getRef', attemptStart)
		const artifactIndex = source.indexOf('const artifactContents = await buildRemoteArtifactContents', attemptStart)
		const updateRefIndex = source.indexOf('await updateRef', attemptStart)

		assert.notEqual(attemptStart, -1)
		assert.notEqual(retryIndex, -1)
		assert.notEqual(refIndex, -1)
		assert.notEqual(artifactIndex, -1)
		assert.notEqual(updateRefIndex, -1)
		assert.ok(attemptStart < refIndex)
		assert.ok(refIndex < artifactIndex)
		assert.ok(artifactIndex < updateRefIndex)
		assert.match(
			source,
			/try \{\n\s*return await attemptPushBlog\(\)\n\s*\} catch \(error\) \{[\s\S]*isGitHubUpdateRefConflictError\(error\)[\s\S]*return attemptPushBlog\(\)/
		)
		assert.doesNotMatch(source, /isGitHubUpdateRefConflictError\(error\)[\s\S]{0,240}await updateRef/)
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
		assert.match(
			source,
			/async function readOptionalLocalBlogText\(response: Response, actionName: string\): Promise<string \| null> \{\n\s*if \(response\.status === 404\) \{\n\s*return null\n\s*\}\n\s*await assertOk\(response, actionName\)/
		)
		assert.match(
			source,
			/async function assertOptionalLocalBlogFileReadable\(response: Response, actionName: string\): Promise<boolean> \{\n\s*if \(response\.status === 404\) \{\n\s*return false\n\s*\}\n\s*await assertOk\(response, actionName\)/
		)
		assert.match(
			source,
			/const hasExistingMarkdown = await assertOptionalLocalBlogFileReadable\(mdResponse, '读取文章 Markdown'\)\n\s*const hasExistingConfig = await assertOptionalLocalBlogFileReadable\(configResponse, '读取文章配置'\)/
		)
		assert.match(
			source,
			/assertCreateBlogSlugAvailable\(\{\n\s*slug: form\.slug,\n\s*storageRaw: await readOptionalLocalBlogText\(storageResponse, '读取博客存储'\),\n\s*indexRaw: await readOptionalLocalBlogText\(indexResponse, '读取博客索引'\),\n\s*hasExistingFiles: hasExistingMarkdown \|\| hasExistingConfig\n\s*\}\)/
		)
		assert.doesNotMatch(source, /storageRaw: storageResponse\.ok \? await storageResponse\.text\(\) : null/)
		assert.doesNotMatch(source, /indexRaw: indexResponse\.ok \? await indexResponse\.text\(\) : null/)
		assert.doesNotMatch(source, /hasExistingFiles: mdResponse\.ok \|\| configResponse\.ok/)
		assert.match(
			source,
			/readStorageRaw: async \(\) => \{\n\s*const response = await fetch\('\/blogs\/storage\.json', \{ cache: 'no-store' \}\)\n\s*return readOptionalLocalBlogText\(response, '读取博客存储'\)/
		)
		assert.match(
			source,
			/fallbackReadIndexRaw: async \(\) => \{\n\s*const response = await fetch\('\/blogs\/index\.json', \{ cache: 'no-store' \}\)\n\s*return readOptionalLocalBlogText\(response, '读取博客索引'\)/
		)
	})

	it('本地删除模式应在重建产物前安全读取现有索引', async () => {
		const source = (await fs.readFile(new URL('../hooks/use-publish.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

		assert.match(
			source,
			/const artifactContents = await buildDeleteArtifactContents\(\{\n\s*slug: targetSlug,\n\s*readStorageRaw: async \(\) => \{\n\s*const response = await fetch\('\/blogs\/storage\.json', \{ cache: 'no-store' \}\)\n\s*return readOptionalLocalBlogText\(response, '读取博客存储'\)/
		)
		assert.match(
			source,
			/fallbackReadIndexRaw: async \(\) => \{\n\s*const response = await fetch\('\/blogs\/index\.json', \{ cache: 'no-store' \}\)\n\s*return readOptionalLocalBlogText\(response, '读取博客索引'\)/
		)
		assert.doesNotMatch(source, /return response\.ok \? response\.text\(\) : null/)
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
		assert.match(
			source,
			/function buildLocalUnusedBlogImagePaths\(params: \{[\s\S]*?const previousRepoPaths = collectBlogImageRepoPaths\(\{[\s\S]*?previousMarkdown[\s\S]*?previousCoverPath[\s\S]*?return buildUnusedBlogImageDeleteTreeItems\(\{[\s\S]*?existingRepoFiles: Array\.from\(previousRepoPaths\),[\s\S]*?markdown: params\.markdown,[\s\S]*?protectedRepoPaths: params\.protectedRepoPaths[\s\S]*?\}\)\.map\(item => item\.path\)/
		)
		assert.match(source, /const filePath = `\$\{basePath\}\/\$\{filename\}`\n\s*protectedRepoPaths\.add\(filePath\)\n\s*await uploadLocalBlogPublishImage/)
		assert.match(
			source,
			/if \(mode === 'edit' && previousImageState\) \{\n\s*await cleanupUnusedLocalBlogImages\(\n\s*buildLocalUnusedBlogImagePaths\(\{\n\s*slug: form\.slug,\n\s*previousMarkdown: previousImageState\.markdown,\n\s*previousCoverPath: previousImageState\.coverPath,\n\s*markdown: mdToUpload,\n\s*coverPath,\n\s*protectedRepoPaths\n\s*\}\)\n\s*\)\n\s*\}/
		)
		assert.match(source, /fetch\(`\/blogs\/\$\{slug\}\/index\.md`, \{ cache: 'no-store' \}\)/)
		assert.match(source, /fetch\(`\/blogs\/\$\{slug\}\/config\.json`, \{ cache: 'no-store' \}\)/)
		assert.match(source, /const previousMarkdown = await readOptionalLocalBlogText\(markdownResponse, '读取旧文章 Markdown'\)/)
		assert.match(source, /const configRaw = await readOptionalLocalBlogText\(configResponse, '读取旧文章配置'\)/)
		assert.match(source, /const config = JSON\.parse\(configRaw\)/)
		assert.doesNotMatch(source, /markdownResponse\.ok \? await markdownResponse\.text\(\) : ''/)
		assert.doesNotMatch(source, /if \(configResponse\.ok\) \{\n\s*try \{\n\s*const config = await configResponse\.json\(\)/)
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
		assert.match(
			source,
			/const uploadedPath = uploadedImagePaths\.get\(uploadKey\)!\n\s*placeholderReplacements\.set\(id, uploadedPath\)\n\s*imagePaths\.set\(id, uploadedPath\)/
		)
		assert.match(source, /coverPath = uploadedPath/)
		assert.doesNotMatch(source, /uploadedImagePaths\.has\(hash\)/)
		assert.doesNotMatch(source, /uploadedImagePaths\.set\(hash, publicPath\)/)
	})
})
