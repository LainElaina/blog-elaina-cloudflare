'use client'

import { useMemo, useState } from 'react'
import { Select } from '@/components/select'
import { useBlogFolders } from '@/hooks/use-blog-folders'
import { buildFolderSelectViewModel } from './folder-select-view-model.ts'

type FolderSelectProps = {
	value?: string
	onChange: (value: string) => void
	className?: string
}

export function FolderSelect({ value = '', onChange, className }: FolderSelectProps) {
	const { folders } = useBlogFolders()
	const [newFolderInput, setNewFolderInput] = useState('')
	const viewModel = useMemo(
		() => buildFolderSelectViewModel({ folders, value, createdFolderInput: newFolderInput || undefined }),
		[folders, value, newFolderInput]
	)

	const handleCreateFolder = () => {
		if (!newFolderInput.trim()) return
		if (!viewModel.nextValueAfterCreate) return
		onChange(viewModel.nextValueAfterCreate)
		setNewFolderInput('')
	}

	return (
		<div className='space-y-2'>
			<Select className={className} value={value} onChange={onChange} options={viewModel.options} />
			{viewModel.emptyMessage && <div className='text-secondary text-xs'>{viewModel.emptyMessage}</div>}
			<div className='flex items-center gap-2'>
				<input
					type='text'
					value={newFolderInput}
					onChange={event => setNewFolderInput(event.target.value)}
					placeholder='新建目录，例如：写作/技术'
					className='bg-card min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm'
				/>
				<button type='button' onClick={handleCreateFolder} className='rounded-lg border px-3 py-2 text-sm whitespace-nowrap'>
					{viewModel.createButtonLabel}
				</button>
			</div>
		</div>
	)
}
