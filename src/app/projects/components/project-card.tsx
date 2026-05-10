'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useSize } from '@/hooks/use-size'
import { revokeFilePreviewUrls, revokeUnusedFilePreviewUrls } from '@/lib/upload-preview-url'
import ImageUploadDialog, { type ImageItem } from './image-upload-dialog'
import { isSafeMarkdownImageUrl, isSafeMarkdownLinkUrl } from '@/lib/markdown-url-safety'

export interface Project {
	name: string
	year: number
	description: string
	image: string
	url: string
	tags: string[]
	github?: string
	npm?: string
}

interface ProjectCardProps {
	project: Project
	isEditMode?: boolean
	onUpdate?: (project: Project, oldProject: Project, imageItem?: ImageItem) => void
	onDelete?: () => void
}

export function ProjectCard({ project, isEditMode = false, onUpdate, onDelete }: ProjectCardProps) {
	const [isEditing, setIsEditing] = useState(false)
	const { maxSM } = useSize()
	const [localProject, setLocalProject] = useState(project)
	const [showImageDialog, setShowImageDialog] = useState(false)
	const [imageItem, setImageItem] = useState<ImageItem | null>(null)
	const imageItemRef = useRef<ImageItem | null>(null)

	const setDraftImageItem = useCallback((nextImageItem: ImageItem | null) => {
		revokeUnusedFilePreviewUrls(imageItemRef.current ? [imageItemRef.current] : [], nextImageItem ? [nextImageItem] : [])
		imageItemRef.current = nextImageItem
		setImageItem(nextImageItem)
	}, [])

	useEffect(() => {
		setLocalProject(project)
		setDraftImageItem(null)
	}, [project, setDraftImageItem])

	useEffect(() => {
		if (isEditMode) return
		setLocalProject(project)
		setIsEditing(false)
		setDraftImageItem(null)
	}, [isEditMode, project, setDraftImageItem])

	useEffect(() => {
		return () => {
			revokeFilePreviewUrls(imageItemRef.current ? [imageItemRef.current] : [])
		}
	}, [])

	const handleFieldChange = (field: keyof Project, value: any) => {
		setLocalProject(current => ({ ...current, [field]: value }))
	}

	const handleImageSubmit = (image: ImageItem) => {
		setDraftImageItem(image)
		const imageUrl = image.type === 'url' ? image.url : image.previewUrl
		setLocalProject(current => ({ ...current, image: imageUrl }))
	}

	const handleTagsChange = (tagsStr: string) => {
		const tags = tagsStr
			.split(',')
			.map(t => t.trim())
			.filter(t => t)
		handleFieldChange('tags', tags)
	}

	const handleCancel = () => {
		setDraftImageItem(null)
		setLocalProject(project)
		setIsEditing(false)
	}

	const handleComplete = () => {
		onUpdate?.(localProject, project, imageItem || undefined)
		imageItemRef.current = null
		setImageItem(null)
		setIsEditing(false)
	}

	const canEdit = isEditMode && isEditing
	const imageUrl = isSafeMarkdownImageUrl(localProject.image) ? localProject.image : null
	const websiteUrl = isSafeMarkdownLinkUrl(localProject.url) ? localProject.url : null
	const githubUrl = isSafeMarkdownLinkUrl(localProject.github) ? localProject.github : null
	const npmUrl = isSafeMarkdownLinkUrl(localProject.npm) ? localProject.npm : null

	return (
		<motion.div
			initial={{ opacity: 0, scale: 0.9 }}
			{...(maxSM ? { animate: { opacity: 1, scale: 1 } } : { whileInView: { opacity: 1, scale: 1 } })}
			className='card relative flex flex-col gap-4'>
			{isEditMode && (
				<div className='absolute top-3 right-3 z-10 flex gap-2'>
					{isEditing ? (
						<>
							<button onClick={handleCancel} className='rounded-lg px-2 py-1.5 text-xs text-gray-400 transition-colors hover:text-gray-600'>
								取消
							</button>
							<button onClick={handleComplete} className='rounded-lg px-2 py-1.5 text-xs text-blue-400 transition-colors hover:text-blue-600'>
								完成
							</button>
						</>
					) : (
						<>
							<button onClick={() => setIsEditing(true)} className='rounded-lg px-2 py-1.5 text-xs text-blue-400 transition-colors hover:text-blue-600'>
								编辑
							</button>
							<button onClick={onDelete} className='rounded-lg px-2 py-1.5 text-xs text-red-400 transition-colors hover:text-red-600'>
								删除
							</button>
						</>
					)}
				</div>
			)}

			<div className='flex items-start gap-4'>
				<div className='group relative'>
					{imageUrl && (
						<img
							src={imageUrl}
							alt={localProject.name}
							className={cn('h-16 w-16 shrink-0 rounded-xl object-cover', canEdit && 'cursor-pointer')}
							onClick={() => canEdit && setShowImageDialog(true)}
						/>
					)}
					{canEdit && (
						<div className='pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 opacity-0 transition-opacity group-hover:opacity-100'>
							<span className='text-xs text-white'>更换</span>
						</div>
					)}
				</div>
				<div className='flex-1'>
					<div className='flex items-center gap-2'>
						<h3
							contentEditable={canEdit}
							suppressContentEditableWarning
							onBlur={e => handleFieldChange('name', e.currentTarget.textContent || '')}
							className={cn('text-lg font-semibold', canEdit && 'cursor-text focus:outline-none')}>
							{localProject.name}
						</h3>
						{canEdit ? (
							<input
								type='number'
								value={localProject.year}
								onChange={e => handleFieldChange('year', parseInt(e.target.value) || 0)}
								className='text-secondary border-secondary/20 w-18 rounded border px-2 py-1 text-sm focus:outline-none'
							/>
						) : (
							<span className='text-secondary text-sm'>{localProject.year}</span>
						)}
					</div>
					<div className='mt-2 flex flex-wrap gap-2'>
						{canEdit ? (
							<input
								type='text'
								value={localProject.tags.join(', ')}
								onChange={e => handleTagsChange(e.target.value)}
								placeholder='标签，用逗号分隔'
								className='bg-secondary/10 border-secondary/20 w-full rounded-lg border px-2 py-1 text-xs focus:outline-none'
							/>
						) : (
							localProject.tags.map(tag => (
								<span key={tag} className='text-secondary bg-card rounded-lg px-2 py-1 text-xs'>
									{tag}
								</span>
							))
						)}
					</div>
				</div>
			</div>

			<p
				contentEditable={canEdit}
				suppressContentEditableWarning
				onBlur={e => handleFieldChange('description', e.currentTarget.textContent || '')}
				className={cn('text-secondary text-sm leading-relaxed', canEdit && 'cursor-text focus:outline-none')}>
				{localProject.description}
			</p>

			<div className='flex flex-wrap gap-2'>
				{canEdit ? (
					<>
						<input
							type='url'
							value={localProject.url}
							onChange={e => handleFieldChange('url', e.target.value)}
							placeholder='网站 URL'
							className='bg-secondary/10 border-secondary/20 flex-1 rounded-lg border px-3 py-1.5 text-sm focus:outline-none'
						/>
						<input
							type='url'
							value={localProject.github || ''}
							onChange={e => handleFieldChange('github', e.target.value || undefined)}
							placeholder='GitHub URL（可选）'
							className='bg-secondary/10 border-secondary/20 flex-1 rounded-lg border px-3 py-1.5 text-sm focus:outline-none'
						/>
						<input
							type='url'
							value={localProject.npm || ''}
							onChange={e => handleFieldChange('npm', e.target.value || undefined)}
							placeholder='NPM URL（可选）'
							className='bg-secondary/10 border-secondary/20 flex-1 rounded-lg border px-3 py-1.5 text-sm focus:outline-none'
						/>
					</>
				) : (
					<>
						{websiteUrl && (
							<Link
								href={websiteUrl}
								target='_blank'
								rel='noopener noreferrer'
								className='bg-card hover:bg-bg rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors'>
								Website
							</Link>
						)}
						{githubUrl && (
							<Link
								href={githubUrl}
								target='_blank'
								rel='noopener noreferrer'
								className='bg-card hover:bg-bg rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors'>
								GitHub
							</Link>
						)}
						{npmUrl && (
							<Link
								href={npmUrl}
								target='_blank'
								rel='noopener noreferrer'
								className='bg-card hover:bg-bg rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors'>
								NPM
							</Link>
						)}
					</>
				)}
			</div>

			{canEdit && showImageDialog && (
				<ImageUploadDialog currentImage={localProject.image} onClose={() => setShowImageDialog(false)} onSubmit={handleImageSubmit} />
			)}
		</motion.div>
	)
}
