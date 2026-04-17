'use client'

import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'

import { DialogModal } from '@/components/dialog-modal'
import LogoUploadDialog, { type LogoItem } from './logo-upload-dialog'
import ShareFolderSelect from './share-folder-select'
import type { Share } from './share-card'
import {
	buildShareEditSubmitPayload,
	normalizeShareCategoryInput,
	normalizeShareFolderPathInput,
	normalizeShareUrlInput,
	type ShareEditSubmitPayload
} from './share-folder-select-view-model'

interface CreateDialogProps {
	share: Share | null
	onClose: () => void
	onSave: (payload: ShareEditSubmitPayload<Share, LogoItem>) => void
}

const EMPTY_SHARE: Share = {
	name: '',
	logo: '',
	url: '',
	description: '',
	tags: [],
	stars: 3,
	category: undefined,
	folderPath: undefined
}

export default function CreateDialog({ share, onClose, onSave }: CreateDialogProps) {
	const [formData, setFormData] = useState<Share>(EMPTY_SHARE)
	const [showLogoDialog, setShowLogoDialog] = useState(false)
	const [tagsInput, setTagsInput] = useState('')
	const [logoItem, setLogoItem] = useState<LogoItem | null>(null)

	useEffect(() => {
		if (share) {
			setFormData(share)
			setTagsInput(share.tags.join(', '))
		} else {
			setFormData(EMPTY_SHARE)
			setTagsInput('')
		}
		setLogoItem(null)
	}, [share])

	const handleLogoSubmit = (logo: LogoItem) => {
		setLogoItem(logo)
		const logoUrl = logo.type === 'url' ? logo.url : logo.previewUrl
		setFormData(current => ({ ...current, logo: logoUrl }))
	}

	const handleTagsChange = (value: string) => {
		setTagsInput(value)
		const tags = value
			.split(',')
			.map(tag => tag.trim())
			.filter(Boolean)
		setFormData(current => ({ ...current, tags }))
	}

	const handleSubmit = () => {
		if (!formData.name.trim() || !formData.logo.trim() || !formData.url.trim() || !formData.description.trim()) {
			toast.error('请填写所有必填项')
			return
		}

		if (formData.tags.length === 0) {
			toast.error('请至少添加一个标签')
			return
		}

		const currentUrl = normalizeShareUrlInput(formData.url)
		const nextShare: Share = {
			...formData,
			url: currentUrl,
			category: normalizeShareCategoryInput(formData.category ?? ''),
			folderPath: normalizeShareFolderPathInput(formData.folderPath ?? '')
		}
		const payload = buildShareEditSubmitPayload({
			share: nextShare,
			oldUrl: share?.url,
			logoItem: logoItem ?? undefined
		})
		onSave(payload)
		onClose()
		toast.success(share ? '更新成功' : '添加成功')
	}

	return (
		<DialogModal open onClose={onClose} className='card max-h-[90vh] w-sm overflow-y-auto'>
			<div>
				<div className='mb-4 flex items-center gap-4'>
					<div className='group relative cursor-pointer' onClick={() => setShowLogoDialog(true)}>
						{formData.logo ? (
							<>
								<img src={formData.logo} alt={formData.name} className='h-16 w-16 rounded-xl object-cover' />
								<div className='pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 opacity-0 transition-opacity group-hover:opacity-100'>
									<span className='text-xs text-white'>更换</span>
								</div>
							</>
						) : (
							<div className='flex h-16 w-16 items-center justify-center rounded-xl bg-gray-200'>
								<Plus className='h-6 w-6 text-gray-500' />
							</div>
						)}
					</div>
					<div className='flex-1'>
						<input
							type='text'
							value={formData.name}
							onChange={e => setFormData({ ...formData, name: e.target.value })}
							placeholder='资源名称'
							className='w-full text-lg font-bold focus:outline-none'
						/>
						<input
							type='url'
							value={formData.url}
							onChange={e => setFormData({ ...formData, url: e.target.value })}
							placeholder='https://example.com'
							className='text-secondary mt-1 w-full truncate text-xs focus:outline-none'
						/>
					</div>
				</div>

				<div className='flex items-center gap-0.5'>
					{[1, 2, 3, 4, 5].map(index => (
						<div key={index} onClick={() => setFormData({ ...formData, stars: index })} className='cursor-pointer'>
							<svg width='16' height='16' viewBox='0 0 24 24' className={index <= formData.stars ? 'fill-yellow-400' : 'fill-gray-300'}>
								<path d='M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' />
							</svg>
						</div>
					))}
				</div>

				<div className='mt-3'>
					<input
						type='text'
						value={tagsInput}
						onChange={e => handleTagsChange(e.target.value)}
						placeholder='标签，用逗号分隔（如：图片, 工具）'
						className='w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:outline-none'
					/>
					<div className='mt-2 flex flex-wrap gap-1.5'>
						{formData.tags.map(tag => (
							<span key={tag} className='rounded-full bg-secondary/10 px-2.5 py-0.5 text-xs text-gray-600'>
								{tag}
							</span>
						))}
					</div>
				</div>

				<div className='mt-3 space-y-2'>
					<input
						type='text'
						value={formData.category ?? ''}
						onChange={e => setFormData({ ...formData, category: e.target.value })}
						placeholder='分类（可选）'
						className='w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:outline-none'
					/>
					<ShareFolderSelect
						value={formData.folderPath}
						onChange={value => setFormData(current => ({ ...current, folderPath: value }))}
					/>
				</div>

				<textarea
					value={formData.description}
					onChange={e => setFormData({ ...formData, description: e.target.value })}
					placeholder='资源介绍...'
					className='mt-3 w-full resize-none text-sm leading-relaxed focus:outline-none'
					rows={4}
				/>
			</div>

			<div className='mt-6 flex gap-3'>
				<button onClick={onClose} className='flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm transition-colors hover:bg-gray-50'>
					取消
				</button>
				<button onClick={handleSubmit} className='brand-btn flex-1 justify-center px-4'>
					{share ? '保存' : '添加'}
				</button>
			</div>

			{showLogoDialog && <LogoUploadDialog currentLogo={formData.logo} onClose={() => setShowLogoDialog(false)} onSubmit={handleLogoSubmit} />}
		</DialogModal>
	)
}
