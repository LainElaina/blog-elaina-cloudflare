'use client'

import { useState, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import initialList from './list.json'
import { RandomLayout } from './components/random-layout'
import { MasonryLayout } from './components/masonry-layout'
import { getPicturesDisplayModeSessionStorage, readPicturesDisplayModeFromSessionStorage, writePicturesDisplayModeToSessionStorage, type PicturesDisplayMode } from './display-mode'
import { buildPicturesPageDisplayModeState } from './page-view-model'
import { PicturesPageView } from './page-view'
import UploadDialog from './components/upload-dialog'
import { pushPictures } from './services/push-pictures'
import { useAuthStore } from '@/hooks/use-auth'
import { useConfigStore } from '@/app/(home)/stores/config-store'
import { useSize, useSizeInit } from '@/hooks/use-size'
import type { ImageItem } from '../projects/components/image-upload-dialog'
import { hashFileSHA256 } from '@/lib/file-utils'
import { getFileExt } from '@/lib/utils'
import { useRouter } from 'next/navigation'

export interface Picture {
	id: string
	uploadedAt: string
	description?: string
	image?: string
	images?: string[]
}

export default function Page() {
	const [pictures, setPictures] = useState<Picture[]>(initialList as Picture[])
	const [originalPictures, setOriginalPictures] = useState<Picture[]>(initialList as Picture[])
	const [isEditMode, setIsEditMode] = useState(false)
	const [preferredDisplayMode, setPreferredDisplayMode] = useState<PicturesDisplayMode>('random')
	const [hasRestoredDisplayModePreference, setHasRestoredDisplayModePreference] = useState(false)
	const [isSaving, setIsSaving] = useState(false)
	const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
	const [imageItems, setImageItems] = useState<Map<string, ImageItem>>(new Map())
	const keyInputRef = useRef<HTMLInputElement>(null)
	const router = useRouter()

	const { isAuth, setPrivateKey } = useAuthStore()
	const { siteContent } = useConfigStore()
	const { maxSM: isMobile } = useSize()
	useSizeInit()
	const hideEditButton = siteContent.hideEditButton ?? false

	const handleUploadSubmit = ({ images, description }: { images: ImageItem[]; description: string }) => {
		const now = new Date().toISOString()

		if (images.length === 0) {
			toast.error('请至少选择一张图片')
			return
		}

		const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
		const desc = description.trim() || undefined

		const imageUrls = images.map(imageItem => (imageItem.type === 'url' ? imageItem.url : imageItem.previewUrl))

		const newPicture: Picture = {
			id,
			uploadedAt: now,
			description: desc,
			images: imageUrls
		}

		const newMap = new Map(imageItems)

		images.forEach((imageItem, index) => {
			if (imageItem.type === 'file') {
				newMap.set(`${id}::${index}`, imageItem)
			}
		})

		setPictures(prev => [...prev, newPicture])
		setImageItems(newMap)
		setIsUploadDialogOpen(false)
	}

	const handleDeleteSingleImage = (pictureId: string, imageIndex: number | 'single') => {
		setPictures(prev => {
			return prev
				.map(picture => {
					if (picture.id !== pictureId) return picture

					// 如果是 single image，删除整个 Picture
					if (imageIndex === 'single') {
						return null
					}

					// 如果是 images 数组中的图片
					if (picture.images && picture.images.length > 0) {
						const newImages = picture.images.filter((_, idx) => idx !== imageIndex)
						// 如果删除后数组为空，删除整个 Picture
						if (newImages.length === 0) {
							return null
						}
						return {
							...picture,
							images: newImages
						}
					}

					return picture
				})
				.filter((p): p is Picture => p !== null)
		})

		// 更新 imageItems Map
		setImageItems(prev => {
			const next = new Map(prev)
			if (imageIndex === 'single') {
				// 删除所有相关的文件项
				for (const key of next.keys()) {
					if (key.startsWith(`${pictureId}::`)) {
						next.delete(key)
					}
				}
			} else {
				// 删除特定索引的文件项
				next.delete(`${pictureId}::${imageIndex}`)
				
				// 重新索引：删除索引 imageIndex 后，后面的索引需要前移
				// 例如：删除索引 1，原来的索引 2 变成 1，索引 3 变成 2
				const keysToUpdate: Array<{ oldKey: string; newKey: string }> = []
				for (const key of next.keys()) {
					if (key.startsWith(`${pictureId}::`)) {
						const [, indexStr] = key.split('::')
						const oldIndex = Number(indexStr)
						if (!isNaN(oldIndex) && oldIndex > imageIndex) {
							const newIndex = oldIndex - 1
							keysToUpdate.push({
								oldKey: key,
								newKey: `${pictureId}::${newIndex}`
							})
						}
					}
				}
				
				// 执行重新索引
				for (const { oldKey, newKey } of keysToUpdate) {
					const value = next.get(oldKey)
					if (value) {
						next.set(newKey, value)
						next.delete(oldKey)
					}
				}
			}
			return next
		})
	}

	const handleDeleteGroup = (picture: Picture) => {
		if (!confirm('确定要删除这一组图片吗？')) return

		setPictures(prev => prev.filter(p => p.id !== picture.id))
		setImageItems(prev => {
			const next = new Map(prev)
			for (const key of next.keys()) {
				if (key.startsWith(`${picture.id}::`)) {
					next.delete(key)
				}
			}
			return next
		})
	}

	const handleChoosePrivateKey = async (file: File) => {
		try {
			const text = await file.text()
			setPrivateKey(text)
			await handleSave()
		} catch (error) {
			console.error('Failed to read private key:', error)
			toast.error('读取密钥文件失败')
		}
	}

	const handleSaveClick = () => {
		if (process.env.NODE_ENV === 'development') {
			handleSave()
		} else if (!isAuth) {
			keyInputRef.current?.click()
		} else {
			handleSave()
		}
	}

	const handleSave = async () => {
		setIsSaving(true)

		try {
			if (process.env.NODE_ENV === 'development') {
				let updatedPictures = [...pictures]
				// Upload new images
				for (const [url, imageItem] of imageItems.entries()) {
					if (imageItem.type === 'file') {
						const hash = imageItem.hash || (await hashFileSHA256(imageItem.file))
						const ext = getFileExt(imageItem.file.name)
						const filename = `${hash}${ext}`
						const publicPath = `/images/pictures/${filename}`
						const formData = new FormData()
						formData.append('file', imageItem.file)
						formData.append('path', `public${publicPath}`)
						await fetch('/api/upload-image', { method: 'POST', body: formData })
						// Replace placeholder URL with actual path
						updatedPictures = updatedPictures.map(p => ({
							...p,
							image: p.image === url ? publicPath : p.image,
							images: p.images?.map(u => u === url ? publicPath : u)
						}))
					}
				}
				// Find orphaned images (in original but not in current)
				const currentUrls = new Set<string>()
				for (const p of updatedPictures) {
					if (p.image) currentUrls.add(p.image)
					p.images?.forEach(u => currentUrls.add(u))
				}
				for (const p of originalPictures) {
					const urls = [p.image, ...(p.images || [])].filter(Boolean) as string[]
					for (const url of urls) {
						if (!currentUrls.has(url) && url.startsWith('/images/pictures/')) {
							await fetch('/api/delete-image', {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({ path: `public${url}` })
							})
						}
					}
				}
				await fetch('/api/save-file', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ path: 'src/app/pictures/list.json', content: JSON.stringify(updatedPictures, null, '\t') })
				})
				setPictures(updatedPictures)
			} else {
				await pushPictures({ pictures, imageItems })
			}

			setOriginalPictures(pictures)
			setImageItems(new Map())
			setIsEditMode(false)
			toast.success('保存成功！')
		} catch (error: any) {
			console.error('Failed to save:', error)
			toast.error(`保存失败: ${error?.message || '未知错误'}`)
		} finally {
			setIsSaving(false)
		}
	}

	const handleCancel = () => {
		setPictures(originalPictures)
		setImageItems(new Map())
		setIsEditMode(false)
	}

	const isDev = process.env.NODE_ENV === 'development'
	const buttonText = (isDev || isAuth) ? '保存' : '导入密钥'
	const displayModeState = buildPicturesPageDisplayModeState({
		preferredDisplayMode,
		isEditMode,
		isMobile,
		onDisplayModeChange: setPreferredDisplayMode
	})

	useEffect(() => {
		setPreferredDisplayMode(
			readPicturesDisplayModeFromSessionStorage(
				getPicturesDisplayModeSessionStorage(typeof window === 'undefined' ? null : window)
			)
		)
		setHasRestoredDisplayModePreference(true)
	}, [])

	useEffect(() => {
		if (!hasRestoredDisplayModePreference) {
			return
		}

		writePicturesDisplayModeToSessionStorage(
			preferredDisplayMode,
			getPicturesDisplayModeSessionStorage(typeof window === 'undefined' ? null : window)
		)
	}, [hasRestoredDisplayModePreference, preferredDisplayMode])

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (!isEditMode && (e.ctrlKey || e.metaKey) && e.key === ',') {
				e.preventDefault()
				setIsEditMode(true)
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => {
			window.removeEventListener('keydown', handleKeyDown)
		}
	}, [isEditMode])

	return (
		<>
			<input
				ref={keyInputRef}
				type='file'
				accept='.pem'
				className='hidden'
				onChange={async e => {
					const f = e.target.files?.[0]
					if (f) await handleChoosePrivateKey(f)
					if (e.currentTarget) e.currentTarget.value = ''
				}}
			/>

			<PicturesPageView
				pictures={pictures}
				isEditMode={isEditMode}
				isSaving={isSaving}
				hideEditButton={hideEditButton}
				buttonText={buttonText}
				effectiveDisplayMode={displayModeState.effectiveDisplayMode}
				onDisplayModeChange={displayModeState.onDisplayModeChange}
				onEnterEditMode={() => setIsEditMode(true)}
				onCancelEdit={handleCancel}
				onOpenUploadDialog={() => setIsUploadDialogOpen(true)}
				onSave={handleSaveClick}
				onOpenImageToolbox={() => router.push('/image-toolbox')}
				onDeleteSingle={handleDeleteSingleImage}
				onDeleteGroup={handleDeleteGroup}
				renderRandomLayout={layoutProps => <RandomLayout {...layoutProps} />}
				renderMasonryLayout={layoutProps => <MasonryLayout {...layoutProps} />}
			/>

			{isUploadDialogOpen && <UploadDialog onClose={() => setIsUploadDialogOpen(false)} onSubmit={handleUploadSubmit} />}
		</>
	)
}
