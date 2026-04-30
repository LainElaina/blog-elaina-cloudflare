'use client'

import { useState, useRef, useEffect, useCallback, type SetStateAction } from 'react'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { DialogModal } from '@/components/dialog-modal'
import { useAuthStore } from '@/hooks/use-auth'
import { useConfigStore } from '../stores/config-store'
import { pushSiteContent } from '../services/push-site-content'
import { pushSiteContentLocal } from '../services/push-site-content-local'
import { shouldClearLocalPendingAssetUploads } from '../services/push-site-content-local-utils'
import type { SiteContent, CardStyles } from '../stores/config-store'
import { SiteSettings, type FileItem, type ArtImageUploads, type BackgroundImageUploads, type SocialButtonImageUploads } from './site-settings'
import { revokeFilePreviewUrls, revokeUnusedFilePreviewUrls } from '@/lib/upload-preview-url'
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

function collectPendingAssetUploads(
	faviconItem: FileItem | null,
	avatarItem: FileItem | null,
	artImageUploads: ArtImageUploads,
	backgroundImageUploads: BackgroundImageUploads,
	socialButtonImageUploads: SocialButtonImageUploads
) {
	return [
		...(faviconItem ? [faviconItem] : []),
		...(avatarItem ? [avatarItem] : []),
		...Object.values(artImageUploads),
		...Object.values(backgroundImageUploads),
		...Object.values(socialButtonImageUploads)
	]
}

interface PendingAssetUploadsState {
	faviconItem: FileItem | null
	avatarItem: FileItem | null
	artImageUploads: ArtImageUploads
	backgroundImageUploads: BackgroundImageUploads
	socialButtonImageUploads: SocialButtonImageUploads
}

function createEmptyPendingAssetUploads(): PendingAssetUploadsState {
	return {
		faviconItem: null,
		avatarItem: null,
		artImageUploads: {},
		backgroundImageUploads: {},
		socialButtonImageUploads: {}
	}
}

function resolveStateAction<T>(action: SetStateAction<T>, previous: T): T {
	return typeof action === 'function' ? (action as (previousState: T) => T)(previous) : action
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
	const pendingAssetUploadsRef = useRef<PendingAssetUploadsState>(createEmptyPendingAssetUploads())

	const getPendingAssetUploads = useCallback(() => {
		const current = pendingAssetUploadsRef.current
		return collectPendingAssetUploads(
			current.faviconItem,
			current.avatarItem,
			current.artImageUploads,
			current.backgroundImageUploads,
			current.socialButtonImageUploads
		)
	}, [])

	const revokePendingAssetUploads = useCallback(() => {
		revokeFilePreviewUrls(getPendingAssetUploads())
		pendingAssetUploadsRef.current = createEmptyPendingAssetUploads()
	}, [getPendingAssetUploads])

	const clearPendingAssetUploads = useCallback(() => {
		revokePendingAssetUploads()
		setFaviconItem(null)
		setAvatarItem(null)
		setArtImageUploads({})
		setBackgroundImageUploads({})
		setSocialButtonImageUploads({})
	}, [revokePendingAssetUploads])

	const setFaviconItemWithPreviewCleanup = useCallback((action: SetStateAction<FileItem | null>) => {
		const previous = pendingAssetUploadsRef.current.faviconItem
		const next = resolveStateAction(action, previous)
		revokeUnusedFilePreviewUrls(previous ? [previous] : [], next ? [next] : [])
		pendingAssetUploadsRef.current.faviconItem = next
		setFaviconItem(next)
	}, [])

	const setAvatarItemWithPreviewCleanup = useCallback((action: SetStateAction<FileItem | null>) => {
		const previous = pendingAssetUploadsRef.current.avatarItem
		const next = resolveStateAction(action, previous)
		revokeUnusedFilePreviewUrls(previous ? [previous] : [], next ? [next] : [])
		pendingAssetUploadsRef.current.avatarItem = next
		setAvatarItem(next)
	}, [])

	const setArtImageUploadsWithPreviewCleanup = useCallback((action: SetStateAction<ArtImageUploads>) => {
		const previous = pendingAssetUploadsRef.current.artImageUploads
		const next = resolveStateAction(action, previous)
		revokeUnusedFilePreviewUrls(Object.values(previous), Object.values(next))
		pendingAssetUploadsRef.current.artImageUploads = next
		setArtImageUploads(next)
	}, [])

	const setBackgroundImageUploadsWithPreviewCleanup = useCallback((action: SetStateAction<BackgroundImageUploads>) => {
		const previous = pendingAssetUploadsRef.current.backgroundImageUploads
		const next = resolveStateAction(action, previous)
		revokeUnusedFilePreviewUrls(Object.values(previous), Object.values(next))
		pendingAssetUploadsRef.current.backgroundImageUploads = next
		setBackgroundImageUploads(next)
	}, [])

	const setSocialButtonImageUploadsWithPreviewCleanup = useCallback((action: SetStateAction<SocialButtonImageUploads>) => {
		const previous = pendingAssetUploadsRef.current.socialButtonImageUploads
		const next = resolveStateAction(action, previous)
		revokeUnusedFilePreviewUrls(Object.values(previous), Object.values(next))
		pendingAssetUploadsRef.current.socialButtonImageUploads = next
		setSocialButtonImageUploads(next)
	}, [])

	useEffect(() => {
		if (open) {
			const current = normalizeSiteContentCardStyle({ ...siteContent })
			const currentCardStyles = { ...cardStyles }
			setFormData(current)
			setCardStylesData(currentCardStyles)
			setOriginalData(current)
			setOriginalCardStyles(currentCardStyles)
			setActiveTab('site')
		}
	}, [open, siteContent, cardStyles])

	useEffect(() => {
		return () => {
			revokePendingAssetUploads()
		}
	}, [revokePendingAssetUploads])

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
			setOriginalData(formData)
			setOriginalCardStyles(cardStylesData)
			updateThemeVariables(formData.theme)
			clearPendingAssetUploads()
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
			if (action === 'publish') {
				setOriginalData(formData)
				setOriginalCardStyles(cardStylesData)
			}
			updateThemeVariables(formData.theme)
			if (shouldClearLocalPendingAssetUploads(action)) {
				clearPendingAssetUploads()
			}
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
				originalCardStyles,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				true
			)
			await syncDraftState()
			window.location.reload()
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
		clearPendingAssetUploads()
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
							setFaviconItem={setFaviconItemWithPreviewCleanup}
							avatarItem={avatarItem}
							setAvatarItem={setAvatarItemWithPreviewCleanup}
							artImageUploads={artImageUploads}
							setArtImageUploads={setArtImageUploadsWithPreviewCleanup}
							backgroundImageUploads={backgroundImageUploads}
							setBackgroundImageUploads={setBackgroundImageUploadsWithPreviewCleanup}
							socialButtonImageUploads={socialButtonImageUploads}
							setSocialButtonImageUploads={setSocialButtonImageUploadsWithPreviewCleanup}
						/>
					)}

					{activeTab === 'color' && <ColorConfig formData={formData} setFormData={setFormData} />}
					{process.env.NODE_ENV === 'development' && <BlogMigrationPanel />}
				</div>
			</DialogModal>
		</>
	)
}
