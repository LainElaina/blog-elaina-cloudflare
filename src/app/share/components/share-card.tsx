'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { motion } from 'motion/react'
import StarRating from '@/components/star-rating'
import { useSize } from '@/hooks/use-size'
import { cn } from '@/lib/utils'
import EditableStarRating from '@/components/editable-star-rating'
import LogoUploadDialog, { type LogoItem } from './logo-upload-dialog'
import ShareFolderSelect from './share-folder-select'
import {
	normalizeShareCategoryInput,
	normalizeShareFolderPathInput,
	normalizeShareUrlInput
} from './share-folder-select-view-model'

export interface Share {
	name: string
	logo: string
	url: string
	description: string
	tags: string[]
	stars: number
	category?: string
	folderPath?: string
}

export const ShareCardEditCallbacksContext = createContext<{
	onCancelEdit?: (params: {
		originalShare: Share
		draftShare: Share
		logoItem?: LogoItem
		initialLogoItem?: LogoItem
	}) => void
	getPendingLogoItem?: (url: string) => LogoItem | undefined
	onEditSessionStart?: (url: string) => void
	onEditSessionFinish?: (url: string) => void
}>({})

interface ShareCardProps {
	share: Share
	isEditMode?: boolean
	onUpdate?: (
		share: Share,
		oldShare: Share,
		logoItem?: LogoItem,
		oldUrl?: string,
		currentUrl?: string
	) => void
	onDelete?: () => void
}

export function ShareCard({ share, isEditMode = false, onUpdate, onDelete }: ShareCardProps) {
	const [expanded, setExpanded] = useState(false)
	const [isEditing, setIsEditing] = useState(false)
	const { maxSM } = useSize()
	const [localShare, setLocalShare] = useState(share)
	const [showLogoDialog, setShowLogoDialog] = useState(false)
	const [logoItem, setLogoItem] = useState<LogoItem | null>(null)
	const [editSessionOriginal, setEditSessionOriginal] = useState<Share | null>(null)
	const [editSessionInitialLogoItem, setEditSessionInitialLogoItem] = useState<LogoItem | undefined>()
	const { onCancelEdit, getPendingLogoItem, onEditSessionStart, onEditSessionFinish } = useContext(ShareCardEditCallbacksContext)

	useEffect(() => {
		setLocalShare(share)
	}, [share])

	useEffect(() => {
		if (!isEditMode) {
			setIsEditing(false)
			setLogoItem(null)
			setEditSessionOriginal(null)
			setEditSessionInitialLogoItem(undefined)
		}
	}, [isEditMode])

	const emitUpdate = (updated: Share, nextLogoItem?: LogoItem) => {
		const oldUrl = share.url
		const currentUrl = updated.url
		onUpdate?.(updated, share, nextLogoItem, oldUrl, currentUrl)
	}

	const handleFieldChange = (field: keyof Share, value: Share[keyof Share]) => {
		const nextValue =
			field === 'category'
				? normalizeShareCategoryInput(typeof value === 'string' ? value : '')
				: field === 'folderPath'
					? normalizeShareFolderPathInput(typeof value === 'string' ? value : '')
					: field === 'url'
						? normalizeShareUrlInput(typeof value === 'string' ? value : '')
						: value
		const updated = { ...localShare, [field]: nextValue }
		setLocalShare(updated)
		emitUpdate(updated, logoItem || undefined)
	}

	const handleLogoSubmit = (logo: LogoItem) => {
		setLogoItem(logo)
		const logoUrl = logo.type === 'url' ? logo.url : logo.previewUrl
		const updated = { ...localShare, logo: logoUrl }
		setLocalShare(updated)
		emitUpdate(updated, logo)
	}

	const handleTagsChange = (tagsStr: string) => {
		const tags = tagsStr
			.split(',')
			.map(t => t.trim())
			.filter(t => t)
		handleFieldChange('tags', tags)
	}

	const handleStartEdit = () => {
		setEditSessionOriginal(share)
		setEditSessionInitialLogoItem(getPendingLogoItem?.(share.url))
		setLogoItem(null)
		onEditSessionStart?.(share.url)
		setIsEditing(true)
	}

	const handleCancel = () => {
		const originalShare = editSessionOriginal ?? share
		onEditSessionFinish?.(localShare.url)
		onCancelEdit?.({
			originalShare,
			draftShare: localShare,
			logoItem: logoItem ?? undefined,
			initialLogoItem: editSessionInitialLogoItem
		})
		setLocalShare(originalShare)
		setIsEditing(false)
		setLogoItem(null)
		setEditSessionOriginal(null)
		setEditSessionInitialLogoItem(undefined)
	}

	const handleFinishEdit = () => {
		onEditSessionFinish?.(localShare.url)
		setIsEditing(false)
		setLogoItem(null)
		setEditSessionOriginal(null)
		setEditSessionInitialLogoItem(undefined)
	}

	const canEdit = isEditMode && isEditing

	return (
		<motion.div
			initial={{ opacity: 0, scale: 0.6 }}
			{...(maxSM ? { animate: { opacity: 1, scale: 1 } } : { whileInView: { opacity: 1, scale: 1 } })}
			className='card relative block overflow-hidden'>
			{isEditMode && (
				<div className='absolute top-3 right-3 z-10 flex gap-2'>
					{isEditing ? (
						<>
							<button onClick={handleCancel} className='rounded-lg px-2 py-1.5 text-xs text-gray-400 transition-colors hover:text-gray-600'>
								取消
							</button>
							<button onClick={handleFinishEdit} className='rounded-lg px-2 py-1.5 text-xs text-blue-400 transition-colors hover:text-blue-600'>
								完成
							</button>
						</>
					) : (
						<>
							<button onClick={handleStartEdit} className='rounded-lg px-2 py-1.5 text-xs text-blue-400 transition-colors hover:text-blue-600'>
								编辑
							</button>
							<button onClick={onDelete} className='rounded-lg px-2 py-1.5 text-xs text-red-400 transition-colors hover:text-red-600'>
								删除
							</button>
						</>
					)}
				</div>
			)}

			<div>
				<div className='mb-4 flex items-center gap-4'>
					<div className='group relative'>
						<img
							src={localShare.logo}
							alt={localShare.name}
							className={cn('h-16 w-16 rounded-xl object-cover', canEdit && 'cursor-pointer')}
							onClick={() => canEdit && setShowLogoDialog(true)}
						/>
						{canEdit && (
							<div className='ev pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 opacity-0 transition-opacity group-hover:opacity-100'>
								<span className='text-xs text-white'>更换</span>
							</div>
						)}
					</div>
					<div className='flex-1'>
						<h3
							contentEditable={canEdit}
							suppressContentEditableWarning
							onBlur={e => handleFieldChange('name', e.currentTarget.textContent || '')}
							className={cn('group-hover:text-brand text-lg font-bold transition-colors focus:outline-none', canEdit && 'cursor-text')}>
							{localShare.name}
						</h3>
						{canEdit ? (
							<div
								contentEditable
								suppressContentEditableWarning
								onBlur={e => handleFieldChange('url', e.currentTarget.textContent || '')}
								className='text-secondary mt-1 block max-w-[200px] cursor-text truncate text-xs focus:outline-none'>
								{localShare.url}
							</div>
						) : (
							<a
								href={localShare.url}
								target='_blank'
								rel='noopener noreferrer'
								className='text-secondary hover:text-brand mt-1 block max-w-[200px] truncate text-xs hover:underline'>
								{localShare.url}
							</a>
						)}
					</div>
				</div>

				{canEdit ? (
					<EditableStarRating stars={localShare.stars} editable={true} onChange={stars => handleFieldChange('stars', stars)} />
				) : (
					<StarRating stars={localShare.stars} />
				)}

				<div className='mt-3 flex flex-wrap gap-1.5'>
					{canEdit ? (
						<input
							type='text'
							value={localShare.tags.join(', ')}
							onChange={e => handleTagsChange(e.target.value)}
							placeholder='标签，用逗号分隔'
							className='w-full rounded-md border border-gray-300 bg-gray-50 px-2 py-1 text-xs focus:outline-none'
						/>
					) : (
						localShare.tags.map(tag => (
							<span key={tag} className='bg-secondary/10 rounded-full px-2.5 py-0.5 text-xs'>
								{tag}
							</span>
						))
					)}
				</div>

				{canEdit && (
					<div className='mt-3 space-y-2'>
						<input
							type='text'
							value={localShare.category ?? ''}
							onChange={e => handleFieldChange('category', e.target.value)}
							placeholder='分类（可选）'
							className='w-full rounded-md border border-gray-300 bg-gray-50 px-2 py-1 text-xs focus:outline-none'
						/>
						<ShareFolderSelect
							value={localShare.folderPath}
							onChange={value => handleFieldChange('folderPath', value)}
							compact
						/>
					</div>
				)}

				<p
					contentEditable={canEdit}
					suppressContentEditableWarning
					onBlur={e => handleFieldChange('description', e.currentTarget.textContent || '')}
					onClick={e => {
						if (!canEdit) {
							e.preventDefault()
							setExpanded(!expanded)
						}
					}}
					className={cn(
						'mt-3 text-sm leading-relaxed text-gray-600 transition-all duration-300 focus:outline-none',
						canEdit ? 'cursor-text' : 'cursor-pointer',
						!canEdit && (expanded ? 'line-clamp-none' : 'line-clamp-3')
					)}>
					{localShare.description}
				</p>
			</div>

			{canEdit && showLogoDialog && <LogoUploadDialog currentLogo={localShare.logo} onClose={() => setShowLogoDialog(false)} onSubmit={handleLogoSubmit} />}
		</motion.div>
	)
}
