import { useCallback } from 'react'
import { readFileAsText, hashFileSHA256 } from '@/lib/file-utils'
import { getFileExt } from '@/lib/utils'
import { toast } from 'sonner'
import {
	pushBlog,
	assertPublishableBlog,
	assertEditableSlug,
	assertPublishableOutput,
	buildRemoteArtifactContents,
	replacePublishLocalImagePlaceholders,
	assertCreateBlogSlugAvailable,
	collectBlogImageRepoPaths,
	buildUnusedBlogImageDeleteTreeItems
} from '../services/push-blog'
import { deleteBlog, buildDeleteArtifactContents } from '../services/delete-blog'
import { useWriteStore, formatDateTimeLocal } from '../stores/write-store'
import { useAuthStore } from '@/hooks/use-auth'
import { buildLocalSaveFilePayloadsFromContents } from '@/app/blog/services/save-blog-edits-utils'
import { buildPublishedWriteSnapshot } from '../write-safety'
import { assertSafeBlogSlug } from '../services/blog-slug'
import {
	rollbackLocalBlogPublish,
	saveLocalBlogPublishFile,
	uploadLocalBlogPublishImage,
	type LocalBlogPublishFileBackup,
	type LocalBlogPublishUploadBackup
} from '../services/local-publish-rollback'

const assertOk = async (response: Response, actionName: string): Promise<void> => {
	if (response.ok) {
		return
	}

	const detail = await response.text().catch(() => '')
	throw new Error(detail ? `${actionName}失败：${detail}` : `${actionName}失败`)
}

async function readOptionalLocalBlogText(response: Response, actionName: string): Promise<string | null> {
	if (response.status === 404) {
		return null
	}
	await assertOk(response, actionName)
	return response.text()
}

async function assertOptionalLocalBlogFileReadable(response: Response, actionName: string): Promise<boolean> {
	if (response.status === 404) {
		return false
	}
	await assertOk(response, actionName)
	return true
}

type PreviousLocalBlogImageState = {
	markdown: string
	coverPath?: string
}

async function readPreviousLocalBlogImageState(slug: string): Promise<PreviousLocalBlogImageState> {
	const [markdownResponse, configResponse] = await Promise.all([
		fetch(`/blogs/${slug}/index.md`, { cache: 'no-store' }),
		fetch(`/blogs/${slug}/config.json`, { cache: 'no-store' })
	])
	const markdown = markdownResponse.ok ? await markdownResponse.text() : ''
	let coverPath: string | undefined

	if (configResponse.ok) {
		try {
			const config = await configResponse.json()
			coverPath = typeof config?.cover === 'string' ? config.cover : undefined
		} catch {
			coverPath = undefined
		}
	}

	return { markdown, coverPath }
}

function buildLocalUnusedBlogImagePaths(params: {
	slug: string
	previousMarkdown: string
	previousCoverPath?: string
	markdown: string
	coverPath?: string
	protectedRepoPaths: ReadonlySet<string>
}): string[] {
	const previousRepoPaths = collectBlogImageRepoPaths({
		slug: params.slug,
		markdown: params.previousMarkdown,
		coverPath: params.previousCoverPath
	})

	return buildUnusedBlogImageDeleteTreeItems({
		slug: params.slug,
		existingRepoFiles: Array.from(previousRepoPaths),
		markdown: params.markdown,
		coverPath: params.coverPath,
		protectedRepoPaths: params.protectedRepoPaths
	}).map(item => item.path)
}

async function deleteLocalBlogImage(path: string) {
	await assertOk(
		await fetch('/api/delete-image', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ path })
		}),
		'删除旧图片'
	)
}

async function cleanupUnusedLocalBlogImages(paths: string[]) {
	for (const path of paths) {
		await deleteLocalBlogImage(path).catch(error => console.warn('删除未使用的博客图片失败:', error))
	}
}

export function usePublish() {
	const { loading, setLoading, form, cover, images, mode, originalSlug } = useWriteStore()
	const { isAuth, setPrivateKey } = useAuthStore()

	const onChoosePrivateKey = useCallback(
		async (file: File) => {
			const pem = await readFileAsText(file)
			setPrivateKey(pem)
		},
		[setPrivateKey]
	)

	const onPublish = useCallback(async () => {
		try {
			setLoading(true)
			assertPublishableBlog({ form, images })
			assertEditableSlug({ form, mode, originalSlug })
			const publishedSnapshot = process.env.NODE_ENV === 'development' ? await pushBlogLocal() : await pushBlog({ form, cover, images, mode, originalSlug })
			const successMsg = mode === 'edit' ? '更新成功' : '发布成功'
			toast.success(successMsg)
			return publishedSnapshot
		} catch (err: any) {
			console.error(err)
			toast.error(err?.message || '操作失败')
			return null
		} finally {
			setLoading(false)
		}
	}, [form, cover, images, mode, originalSlug, setLoading])

	const pushBlogLocal = useCallback(async () => {
		if (!form?.slug) throw new Error('需要 slug')
		assertSafeBlogSlug(form.slug)

		const basePath = `public/blogs/${form.slug}`
		const writtenFiles: LocalBlogPublishFileBackup[] = []
		const uploadedFiles: LocalBlogPublishUploadBackup[] = []
		let mdToUpload = form.md
		let coverPath: string | undefined
		let previousImageState: PreviousLocalBlogImageState | null = null
		const protectedRepoPaths = new Set<string>()

		try {
			if (mode === 'edit') {
				previousImageState = await readPreviousLocalBlogImageState(form.slug)
			}

			if (mode === 'create') {
				const [storageResponse, indexResponse, mdResponse, configResponse] = await Promise.all([
					fetch('/blogs/storage.json', { cache: 'no-store' }),
					fetch('/blogs/index.json', { cache: 'no-store' }),
					fetch(`/blogs/${form.slug}/index.md`, { cache: 'no-store' }),
					fetch(`/blogs/${form.slug}/config.json`, { cache: 'no-store' })
				])
				const hasExistingMarkdown = await assertOptionalLocalBlogFileReadable(mdResponse, '读取文章 Markdown')
				const hasExistingConfig = await assertOptionalLocalBlogFileReadable(configResponse, '读取文章配置')
				assertCreateBlogSlugAvailable({
					slug: form.slug,
					storageRaw: await readOptionalLocalBlogText(storageResponse, '读取博客存储'),
					indexRaw: await readOptionalLocalBlogText(indexResponse, '读取博客索引'),
					hasExistingFiles: hasExistingMarkdown || hasExistingConfig
				})
			}

			const allLocalImages: Array<{ file: File; id: string; hash?: string }> = []
			for (const img of images || []) {
				if (img.type === 'file') {
					allLocalImages.push({ file: img.file, id: img.id, hash: img.hash })
				}
			}
			if (cover?.type === 'file') {
				allLocalImages.push({ file: cover.file, id: cover.id, hash: cover.hash })
			}

			const placeholderReplacements = new Map<string, string>()
			const imagePaths = new Map<string, string>()
			for (const img of allLocalImages) {
				const hash = img.hash || (await hashFileSHA256(img.file))
				const ext = getFileExt(img.file.name)
				const filename = `${hash}${ext}`
				const publicPath = `/blogs/${form.slug}/${filename}`
				const filePath = `${basePath}/${filename}`
				protectedRepoPaths.add(filePath)

				await uploadLocalBlogPublishImage({ file: img.file, path: filePath, actionName: '上传图片', uploadedFiles })

				placeholderReplacements.set(img.id, publicPath)
				imagePaths.set(img.id, publicPath)

				if (cover?.type === 'file' && cover.id === img.id) {
					coverPath = publicPath
				}
			}

			mdToUpload = replacePublishLocalImagePlaceholders(mdToUpload, placeholderReplacements)

			if (cover?.type === 'url') {
				coverPath = cover.url
			}

			assertPublishableOutput({ form: { ...form, md: mdToUpload }, images: [] })

			await saveLocalBlogPublishFile({ path: `${basePath}/index.md`, content: mdToUpload }, '保存 Markdown', writtenFiles)

			const dateStr = form.date || formatDateTimeLocal()
			const config = {
				title: form.title,
				tags: form.tags,
				date: dateStr,
				summary: form.summary,
				cover: coverPath,
				hidden: form.hidden,
				category: form.category,
				folderPath: form.folderPath,
				favorite: form.favorite
			}
			await saveLocalBlogPublishFile({ path: `${basePath}/config.json`, content: JSON.stringify(config, null, 2) }, '保存配置', writtenFiles)

			const artifactContents = await buildRemoteArtifactContents({
				form,
				dateStr,
				coverPath,
				readStorageRaw: async () => {
					const response = await fetch('/blogs/storage.json', { cache: 'no-store' })
					return readOptionalLocalBlogText(response, '读取博客存储')
				},
				fallbackReadIndexRaw: async () => {
					const response = await fetch('/blogs/index.json', { cache: 'no-store' })
					return readOptionalLocalBlogText(response, '读取博客索引')
				}
			})

			const payloads = buildLocalSaveFilePayloadsFromContents(artifactContents)
			for (const payload of payloads) {
				await saveLocalBlogPublishFile(payload, '保存索引产物', writtenFiles)
			}

			if (mode === 'edit' && previousImageState) {
				await cleanupUnusedLocalBlogImages(
					buildLocalUnusedBlogImagePaths({
						slug: form.slug,
						previousMarkdown: previousImageState.markdown,
						previousCoverPath: previousImageState.coverPath,
						markdown: mdToUpload,
						coverPath,
						protectedRepoPaths
					})
				)
			}

			return buildPublishedWriteSnapshot({
				form,
				cover,
				images,
				mode,
				originalSlug,
				markdown: mdToUpload,
				dateStr,
				coverPath,
				imagePaths
			})
		} catch (error) {
			await rollbackLocalBlogPublish(writtenFiles, uploadedFiles)
			throw error
		}
	}, [form, cover, images, mode, originalSlug])

	const onDelete = useCallback(async () => {
		const targetSlug = originalSlug || form.slug
		if (!targetSlug) {
			toast.error('缺少 slug，无法删除')
			return false
		}
		try {
			setLoading(true)
			if (process.env.NODE_ENV === 'development') {
				assertSafeBlogSlug(targetSlug)
				const artifactContents = await buildDeleteArtifactContents({
					slug: targetSlug,
					readStorageRaw: async () => {
						const response = await fetch('/blogs/storage.json', { cache: 'no-store' })
						return readOptionalLocalBlogText(response, '读取博客存储')
					},
					fallbackReadIndexRaw: async () => {
						const response = await fetch('/blogs/index.json', { cache: 'no-store' })
						return readOptionalLocalBlogText(response, '读取博客索引')
					}
				})

				const writtenFiles: LocalBlogPublishFileBackup[] = []
				const uploadedFiles: LocalBlogPublishUploadBackup[] = []
				const payloads = buildLocalSaveFilePayloadsFromContents(artifactContents)
				try {
					for (const payload of payloads) {
						await saveLocalBlogPublishFile(payload, '保存删除索引产物', writtenFiles)
					}
					await assertOk(
						await fetch('/api/delete-dir', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ path: `public/blogs/${targetSlug}` })
						}),
						'删除文章目录'
					)
				} catch (error) {
					await rollbackLocalBlogPublish(writtenFiles, uploadedFiles)
					throw error
				}

				toast.success('删除成功！')
			} else {
				await deleteBlog(targetSlug)
			}
			return true
		} catch (err: any) {
			console.error(err)
			toast.error(err?.message || '删除失败')
			return false
		} finally {
			setLoading(false)
		}
	}, [form.slug, originalSlug, setLoading])

	return {
		isAuth,
		loading,
		onChoosePrivateKey,
		onPublish,
		onDelete
	}
}
