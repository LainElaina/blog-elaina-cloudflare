'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { DialogModal } from '@/components/dialog-modal'
import { useAuthStore } from '@/hooks/use-auth'
import { useConfigStore } from '../stores/config-store'
import { pushSiteContent } from '../services/push-site-content'
import { pushSiteContentLocal } from '../services/push-site-content-local'
import type { SiteContent, CardStyles } from '../stores/config-store'
import { SiteSettings, type FileItem, type ArtImageUploads, type BackgroundImageUploads, type SocialButtonImageUploads } from './site-settings'
import { ColorConfig } from './color-config'
import { BlogMigrationPanel } from './blog-migration-panel'
import { normalizeCardStylePreset } from '@/lib/card-style-preset'

interface DraftReminderItem {
	key: string
	label: string
	page: string
}

interface ConfigDialogProps {
	open: boolean
	onClose: () => void
}

type TabType = 'site' | 'color'

function normalizeSiteContentCardStyle(content: SiteContent): SiteContent {
	return {
		...content,
		theme: {
			...content.theme,
			cardStylePreset: normalizeCardStylePreset(content.theme?.cardStylePreset)
		}
	}
}

export default function ConfigDialog({ open, onClose }: ConfigDialogProps) {
	const { isAuth, setPrivateKey } = useAuthStore()
	const { siteContent, setSiteContent, cardStyles, setCardStyles, regenerateBubbles } = useConfigStore()
	const [formData, setFormData] = useState<SiteContent>(normalizeSiteContentCardStyle(siteContent))
	const [cardStylesData, setCardStylesData] = useState<CardStyles>(cardStyles)
	const [originalData, setOriginalData] = useState<SiteContent>(normalizeSiteContentCardStyle(siteContent))
	const [originalCardStyles, setOriginalCardStyles] = useState<CardStyles>(cardStyles)
	const [isSaving, setIsSaving] = useState(false)
	const [activeTab, setActiveTab] = useState<TabType>('site')
	const keyInputRef = useRef<HTMLInputElement>(null)
	const [faviconItem, setFaviconItem] = useState<FileItem | null>(null)
	const [avatarItem, setAvatarItem] = useState<FileItem | null>(null)
	const [artImageUploads, setArtImageUploads] = useState<ArtImageUploads>({})
	const [backgroundImageUploads, setBackgroundImageUploads] = useState<BackgroundImageUploads>({})
	const [socialButtonImageUploads, setSocialButtonImageUploads] = useState<SocialButtonImageUploads>({})
	const [draftItems, setDraftItems] = useState<DraftReminderItem[]>([])

	useEffect(() => {
		if (open) {
			const current = normalizeSiteContentCardStyle({ ...siteContent })
			const currentCardStyles = { ...cardStyles }
			setFormData(current)
			setCardStylesData(currentCardStyles)
			setOriginalData(current)
			setOriginalCardStyles(currentCardStyles)
			setFaviconItem(null)
			setAvatarItem(null)
			setArtImageUploads({})
			setBackgroundImageUploads({})
			setSocialButtonImageUploads({})
			setActiveTab('site')
		}
	}, [open, siteContent, cardStyles])

	useEffect(() => {
		return () => {
			// Clean up preview URLs on unmount
			if (faviconItem?.type === 'file') {
				URL.revokeObjectURL(faviconItem.previewUrl)
			}
			if (avatarItem?.type === 'file') {
				URL.revokeObjectURL(avatarItem.previewUrl)
			}
			Object.values(artImageUploads).forEach(item => {
				if (item.type === 'file') {
					URL.revokeObjectURL(item.previewUrl)
				}
			})
			Object.values(backgroundImageUploads).forEach(item => {
				if (item.type === 'file') {
					URL.revokeObjectURL(item.previewUrl)
				}
			})
			Object.values(socialButtonImageUploads).forEach(item => {
				if (item.type === 'file') {
					URL.revokeObjectURL(item.previewUrl)
				}
			})
		}
	}, [faviconItem, avatarItem, artImageUploads, backgroundImageUploads, socialButtonImageUploads])

	const syncDraftState = useCallback(async () => {
		if (process.env.NODE_ENV !== 'development') return
		try {
			const response = await fetch('/api/drafts/site-config')
			if (!response.ok) return
			const data = await response.json()
			setDraftItems(Array.isArray(data?.items) ? data.items : [])
		} catch {
			// ignore reminder refresh errors
		}
	}, [])

	useEffect(() => {
		void syncDraftState()
	}, [syncDraftState])

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
		if (!isAuth) {
			keyInputRef.current?.click()
		} else {
			handleSave()
		}
	}

	const handleSave = async () => {
		setIsSaving(true)
		try {
			// Calculate removed art images so that we can delete files in repo
			const originalArtImages = originalData.artImages ?? []
			const currentArtImages = formData.artImages ?? []
			const removedArtImages = originalArtImages.filter(orig => !currentArtImages.some(current => current.id === orig.id))

			// Calculate removed background images
			const originalBackgroundImages = originalData.backgroundImages ?? []
			const currentBackgroundImages = formData.backgroundImages ?? []
			const removedBackgroundImages = originalBackgroundImages.filter(orig => !currentBackgroundImages.some(current => current.id === orig.id))

			await pushSiteContent(
				formData,
				cardStylesData,
				faviconItem,
				avatarItem,
				artImageUploads,
				removedArtImages,
				backgroundImageUploads,
				removedBackgroundImages,
				socialButtonImageUploads
			)
			setSiteContent(formData)
			setCardStyles(cardStylesData)
			updateThemeVariables(formData.theme)
			setFaviconItem(null)
			setAvatarItem(null)
			setArtImageUploads({})
			setBackgroundImageUploads({})
			setSocialButtonImageUploads({})
			onClose()
		} catch (error: any) {
			console.error('Failed to save:', error)
			toast.error(`保存失败: ${error?.message || '未知错误'}`)
		} finally {
			setIsSaving(false)
		}
	}

	const handleLocalSave = async (action: 'draft' | 'publish') => {
		setIsSaving(true)
		try {
			// Calculate removed images
			const originalArtImages = originalData.artImages ?? []
			const currentArtImages = formData.artImages ?? []
			const removedArtImages = originalArtImages.filter(orig => !currentArtImages.some(current => current.id === orig.id))

			const originalBackgroundImages = originalData.backgroundImages ?? []
			const currentBackgroundImages = formData.backgroundImages ?? []
			const removedBackgroundImages = originalBackgroundImages.filter(orig => !currentBackgroundImages.some(current => current.id === orig.id))

			await pushSiteContentLocal(
				action,
				formData,
				originalData,
				cardStylesData,
				originalCardStyles,
				faviconItem,
				avatarItem,
				artImageUploads,
				removedArtImages,
				backgroundImageUploads,
				removedBackgroundImages,
				socialButtonImageUploads
			)

			setSiteContent(formData)
			setCardStyles(cardStylesData)
			updateThemeVariables(formData.theme)
			setFaviconItem(null)
			setAvatarItem(null)
			setArtImageUploads({})
			setBackgroundImageUploads({})
			setSocialButtonImageUploads({})
			await syncDraftState()
			if (action === 'publish') {
				onClose()
			}
		} catch (error: any) {
			toast.error(`本地保存失败: ${error?.message || '未知错误'}`)
		} finally {
			setIsSaving(false)
		}
	}

	const handlePublishFromDraftReminder = async () => {
		setIsSaving(true)
		try {
			await pushSiteContentLocal(
				'publish',
				formData,
				originalData,
				cardStylesData,
				originalCardStyles
			)
			await syncDraftState()
		} catch (error: any) {
			toast.error(`正式保存失败: ${error?.message || '未知错误'}`)
		} finally {
			setIsSaving(false)
		}
	}

	const handleDiscardDraft = async () => {
		setIsSaving(true)
		try {
			const response = await fetch('/api/drafts/site-config', { method: 'DELETE' })
			if (!response.ok) {
				throw new Error('放弃草稿失败')
			}
			await syncDraftState()
			toast.success('已放弃本地草稿')
		} catch (error: any) {
			toast.error(error?.message || '放弃草稿失败')
		} finally {
			setIsSaving(false)
		}
	}

	const handleCancel = () => {
		// Clean up preview URLs
		if (faviconItem?.type === 'file') {
			URL.revokeObjectURL(faviconItem.previewUrl)
		}
		if (avatarItem?.type === 'file') {
			URL.revokeObjectURL(avatarItem.previewUrl)
		}
		Object.values(artImageUploads).forEach(item => {
			if (item.type === 'file') {
				URL.revokeObjectURL(item.previewUrl)
			}
		})
		Object.values(backgroundImageUploads).forEach(item => {
			if (item.type === 'file') {
				URL.revokeObjectURL(item.previewUrl)
			}
		})
		Object.values(socialButtonImageUploads).forEach(item => {
			if (item.type === 'file') {
				URL.revokeObjectURL(item.previewUrl)
			}
		})
		// Restore to the state when dialog was opened
		setSiteContent(originalData)
		setCardStyles(originalCardStyles)
		regenerateBubbles()
		// Restore document title and meta if they were changed by preview
		if (typeof document !== 'undefined') {
			document.title = originalData.meta.title
			const metaDescription = document.querySelector('meta[name="description"]')
			if (metaDescription) {
				metaDescription.setAttribute('content', originalData.meta.description)
			}
		}
		updateThemeVariables(originalData.theme)
		setFaviconItem(null)
		setAvatarItem(null)
		setArtImageUploads({})
		setBackgroundImageUploads({})
		setSocialButtonImageUploads({})
		onClose()
	}

	const updateThemeVariables = (theme?: SiteContent['theme']) => {
		if (typeof document === 'undefined' || !theme) return

		const { colorBrand, colorBrandSecondary, colorPrimary, colorSecondary, colorBg, colorBorder, colorCard, colorArticle } = theme

		const root = document.documentElement

		if (colorBrand) root.style.setProperty('--color-brand', colorBrand)
		if (colorBrandSecondary) root.style.setProperty('--color-brand-secondary', colorBrandSecondary)
		if (colorPrimary) root.style.setProperty('--color-primary', colorPrimary)
		if (colorSecondary) root.style.setProperty('--color-secondary', colorSecondary)
		if (colorBg) root.style.setProperty('--color-bg', colorBg)
		if (colorBorder) root.style.setProperty('--color-border', colorBorder)
		if (colorCard) root.style.setProperty('--color-card', colorCard)
		if (colorArticle) root.style.setProperty('--color-article', colorArticle)
	}

	const handlePreview = () => {
		setSiteContent(formData)
		setCardStyles(cardStylesData)
		regenerateBubbles()

		// Update document title
		if (typeof document !== 'undefined') {
			document.title = formData.meta.title
			const metaDescription = document.querySelector('meta[name="description"]')
			if (metaDescription) {
				metaDescription.setAttribute('content', formData.meta.description)
			}
		}
		updateThemeVariables(formData.theme)

		onClose()
	}

	const buttonText = isAuth ? '保存' : '导入密钥'

	const tabs: { id: TabType; label: string }[] = [
		{ id: 'site', label: '网站设置' },
		{ id: 'color', label: '色彩配置' }
	]

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

			<DialogModal open={open} onClose={handleCancel} className='card scrollbar-none max-h-[90vh] min-h-[600px] w-[640px] overflow-y-auto'>
				{process.env.NODE_ENV === 'development' && draftItems.length > 0 && (
					<div className='mb-4 rounded-xl border border-amber-400/50 bg-amber-100/60 p-3 text-xs text-amber-900'>
						<div className='mb-2 font-medium'>检测到本地草稿，受影响项：</div>
						<ul className='mb-3 list-disc pl-5'>
							{draftItems.map(item => (
								<li key={item.key}>
									<a className='underline' href={item.page}>{item.label}</a>
								</li>
							))}
						</ul>
						<div className='flex gap-2'>
							<button className='rounded-md bg-amber-500 px-3 py-1 text-white disabled:opacity-50' onClick={handlePublishFromDraftReminder} disabled={isSaving}>正式保存</button>
							<button className='rounded-md border border-amber-700 px-3 py-1 disabled:opacity-50' onClick={handleDiscardDraft} disabled={isSaving}>放弃草稿</button>
						</div>
					</div>
				)}
				<div className='mb-6 flex items-center justify-between'>
					<div className='flex gap-1'>
						{tabs.map(tab => (
							<button
								key={tab.id}
								onClick={() => setActiveTab(tab.id)}
								className={`relative px-4 py-2 text-sm font-medium transition-colors ${
									activeTab === tab.id ? 'text-brand' : 'text-secondary hover:text-primary'
								}`}>
								{tab.label}
								{activeTab === tab.id && <div className='bg-brand absolute right-0 bottom-0 left-0 h-0.5' />}
							</button>
						))}
					</div>
					<div className='flex gap-3'>
						{process.env.NODE_ENV === 'development' && (
							<>
								<motion.button
									whileHover={{ scale: 1.05 }}
									whileTap={{ scale: 0.95 }}
									onClick={() => handleLocalSave('draft')}
									disabled={isSaving}
									className='rounded-xl bg-green-500 px-6 py-2 text-sm text-white'>
									{isSaving ? '保存中...' : '保存本地草稿'}
								</motion.button>
								<motion.button
									whileHover={{ scale: 1.05 }}
									whileTap={{ scale: 0.95 }}
									onClick={() => handleLocalSave('publish')}
									disabled={isSaving}
									className='rounded-xl bg-emerald-600 px-6 py-2 text-sm text-white'>
									{isSaving ? '保存中...' : '正式保存'}
								</motion.button>
							</>
						)}
						<motion.button
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
							onClick={handlePreview}
							className='bg-card rounded-xl border px-6 py-2 text-sm'>
							预览
						</motion.button>
						<motion.button
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
							onClick={handleCancel}
							disabled={isSaving}
							className='bg-card rounded-xl border px-6 py-2 text-sm'>
							取消
						</motion.button>
						<motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleSaveClick} disabled={isSaving} className='brand-btn px-6'>
							{isSaving ? '保存中...' : buttonText}
						</motion.button>
					</div>
				</div>

				<div className='min-h-[200px]'>
					{activeTab === 'site' && (
						<SiteSettings
							formData={formData}
							setFormData={setFormData}
							faviconItem={faviconItem}
							setFaviconItem={setFaviconItem}
							avatarItem={avatarItem}
							setAvatarItem={setAvatarItem}
							artImageUploads={artImageUploads}
							setArtImageUploads={setArtImageUploads}
							backgroundImageUploads={backgroundImageUploads}
							setBackgroundImageUploads={setBackgroundImageUploads}
							socialButtonImageUploads={socialButtonImageUploads}
							setSocialButtonImageUploads={setSocialButtonImageUploads}
						/>
					)}

					{activeTab === 'color' && <ColorConfig formData={formData} setFormData={setFormData} />}
					{process.env.NODE_ENV === 'development' && <BlogMigrationPanel />}
				</div>
			</DialogModal>
		</>
	)
}
