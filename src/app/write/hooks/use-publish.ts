import { useCallback } from 'react'
import { readFileAsText, hashFileSHA256 } from '@/lib/file-utils'
import { getFileExt } from '@/lib/utils'
import { toast } from 'sonner'
import { pushBlog, buildBlogUpsertItem, buildRemoteArtifactContents } from '../services/push-blog'
import { deleteBlog, buildDeleteArtifactContents } from '../services/delete-blog'
import { useWriteStore, formatDateTimeLocal } from '../stores/write-store'
import { useAuthStore } from '@/hooks/use-auth'
import { buildLocalSaveFilePayloadsFromContents } from '@/app/blog/services/save-blog-edits-utils'

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
			if (process.env.NODE_ENV === 'development') {
				await pushBlogLocal()
			} else {
				await pushBlog({ form, cover, images, mode, originalSlug })
			}
			const successMsg = mode === 'edit' ? '更新成功' : '发布成功'
			toast.success(successMsg)
		} catch (err: any) {
			console.error(err)
			toast.error(err?.message || '操作失败')
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

		for (const img of allLocalImages) {
			const hash = img.hash || (await hashFileSHA256(img.file))
			const ext = getFileExt(img.file.name)
			const filename = `${hash}${ext}`
			const publicPath = `/blogs/${form.slug}/${filename}`

			const formData = new FormData()
			formData.append('file', img.file)
			formData.append('path', `${basePath}/${filename}`)
			await fetch('/api/upload-image', { method: 'POST', body: formData })

			const placeholder = `local-image:${img.id}`
			mdToUpload = mdToUpload.split(`(${placeholder})`).join(`(${publicPath})`)

			if (cover?.type === 'file' && cover.id === img.id) {
				coverPath = publicPath
			}
		}

		if (cover?.type === 'url') {
			coverPath = cover.url
		}

		await fetch('/api/save-file', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ path: `${basePath}/index.md`, content: mdToUpload })
		})

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
		await fetch('/api/save-file', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ path: `${basePath}/config.json`, content: JSON.stringify(config, null, 2) })
		})

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
			await fetch('/api/save-file', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			})
		}
	}, [form, cover, images])

	const onDelete = useCallback(async () => {
		const targetSlug = originalSlug || form.slug
		if (!targetSlug) {
			toast.error('缺少 slug，无法删除')
			return
		}
		try {
			setLoading(true)
			if (process.env.NODE_ENV === 'development') {
				await fetch('/api/delete-dir', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ path: `public/blogs/${targetSlug}` })
				})

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
					await fetch('/api/save-file', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(payload)
					})
				}
				toast.success('删除成功！')
			} else {
				await deleteBlog(targetSlug)
			}
		} catch (err: any) {
			console.error(err)
			toast.error(err?.message || '删除失败')
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
