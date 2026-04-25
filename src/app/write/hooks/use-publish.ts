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
	replacePublishLocalImagePlaceholders
} from '../services/push-blog'
import { deleteBlog, buildDeleteArtifactContents } from '../services/delete-blog'
import { useWriteStore, formatDateTimeLocal } from '../stores/write-store'
import { useAuthStore } from '@/hooks/use-auth'
import { buildLocalSaveFilePayloadsFromContents } from '@/app/blog/services/save-blog-edits-utils'

const assertOk = async (response: Response, actionName: string): Promise<void> => {
	if (response.ok) {
		return
	}

	const detail = await response.text().catch(() => '')
	throw new Error(detail ? `${actionName}失败：${detail}` : `${actionName}失败`)
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
			if (process.env.NODE_ENV === 'development') {
				await pushBlogLocal()
			} else {
				await pushBlog({ form, cover, images, mode, originalSlug })
			}
			const successMsg = mode === 'edit' ? '更新成功' : '发布成功'
			toast.success(successMsg)
			return true
		} catch (err: any) {
			console.error(err)
			toast.error(err?.message || '操作失败')
			return false
		} finally {
			setLoading(false)
		}
	}, [form, cover, images, mode, originalSlug, setLoading])

	const pushBlogLocal = useCallback(async () => {
		if (!form?.slug) throw new Error('需要 slug')

		const basePath = `public/blogs/${form.slug}`
		let mdToUpload = form.md
		let coverPath: string | undefined

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
		for (const img of allLocalImages) {
			const hash = img.hash || (await hashFileSHA256(img.file))
			const ext = getFileExt(img.file.name)
			const filename = `${hash}${ext}`
			const publicPath = `/blogs/${form.slug}/${filename}`

			const formData = new FormData()
			formData.append('file', img.file)
			formData.append('path', `${basePath}/${filename}`)
			await assertOk(await fetch('/api/upload-image', { method: 'POST', body: formData }), '上传图片')

			placeholderReplacements.set(img.id, publicPath)

			if (cover?.type === 'file' && cover.id === img.id) {
				coverPath = publicPath
			}
		}

		mdToUpload = replacePublishLocalImagePlaceholders(mdToUpload, placeholderReplacements)

		if (cover?.type === 'url') {
			coverPath = cover.url
		}

		assertPublishableOutput({ form: { ...form, md: mdToUpload }, images: [] })

		await assertOk(
			await fetch('/api/save-file', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ path: `${basePath}/index.md`, content: mdToUpload })
			}),
			'保存 Markdown'
		)

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
		await assertOk(
			await fetch('/api/save-file', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ path: `${basePath}/config.json`, content: JSON.stringify(config, null, 2) })
			}),
			'保存配置'
		)

		const artifactContents = await buildRemoteArtifactContents({
			form,
			dateStr,
			coverPath,
			readStorageRaw: async () => {
				const response = await fetch('/blogs/storage.json', { cache: 'no-store' })
				return response.ok ? response.text() : null
			},
			fallbackReadIndexRaw: async () => {
				const response = await fetch('/blogs/index.json', { cache: 'no-store' })
				return response.ok ? response.text() : null
			}
		})

		const payloads = buildLocalSaveFilePayloadsFromContents(artifactContents)
		for (const payload of payloads) {
			await assertOk(
				await fetch('/api/save-file', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				}),
				'保存索引产物'
			)
		}
	}, [form, cover, images])

	const onDelete = useCallback(async () => {
		const targetSlug = originalSlug || form.slug
		if (!targetSlug) {
			toast.error('缺少 slug，无法删除')
			return false
		}
		try {
			setLoading(true)
			if (process.env.NODE_ENV === 'development') {
				await assertOk(
					await fetch('/api/delete-dir', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ path: `public/blogs/${targetSlug}` })
					}),
					'删除文章目录'
				)

				const artifactContents = await buildDeleteArtifactContents({
					slug: targetSlug,
					readStorageRaw: async () => {
						const response = await fetch('/blogs/storage.json', { cache: 'no-store' })
						return response.ok ? response.text() : null
					},
					fallbackReadIndexRaw: async () => {
						const response = await fetch('/blogs/index.json', { cache: 'no-store' })
						return response.ok ? response.text() : null
					}
				})

				const payloads = buildLocalSaveFilePayloadsFromContents(artifactContents)
				for (const payload of payloads) {
					await assertOk(
						await fetch('/api/save-file', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify(payload)
						}),
						'保存删除索引产物'
					)
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
