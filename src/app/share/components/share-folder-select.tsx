'use client'

import { createContext, useContext, useMemo, useState } from 'react'

import { Select } from '@/components/select'

import { buildShareFolderSelectViewModel, normalizeShareFolderPathInput } from './share-folder-select-view-model'

export const ShareFolderSelectFoldersContext = createContext<string[]>([])

type ShareFolderSelectProps = {
	value?: string
	folders?: string[]
	onChange: (value?: string) => void
	compact?: boolean
}

export default function ShareFolderSelect({ value, folders, onChange, compact = false }: ShareFolderSelectProps) {
	const contextFolders = useContext(ShareFolderSelectFoldersContext)
	const resolvedFolders = folders ?? contextFolders
	const [createdFolderInput, setCreatedFolderInput] = useState('')

	const viewModel = useMemo(
		() =>
			buildShareFolderSelectViewModel({
				folders: resolvedFolders,
				value: value ?? '',
				createdFolderInput
			}),
		[resolvedFolders, value, createdFolderInput]
	)

	const handleCreateFolder = () => {
		if (!viewModel.nextValueAfterCreate) return
		onChange(viewModel.nextValueAfterCreate)
		setCreatedFolderInput('')
	}

	const fieldClassName = compact
		? 'bg-card w-full rounded-md border px-2 py-1 text-xs'
		: 'bg-card w-full rounded-lg border px-3 py-2 text-sm'
	const inputClassName = compact
		? 'bg-card min-w-0 flex-1 rounded-md border px-2 py-1 text-xs'
		: 'bg-card min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm'
	const buttonClassName = compact
		? 'rounded-md border px-2 py-1 text-xs whitespace-nowrap'
		: 'rounded-lg border px-3 py-2 text-sm whitespace-nowrap'
	const createButtonLabel = '确认目录'

	return (
		<div className='space-y-2'>
			<Select
				className={fieldClassName}
				value={normalizeShareFolderPathInput(value) ?? ''}
				onChange={nextValue => onChange(normalizeShareFolderPathInput(nextValue))}
				options={viewModel.options}
			/>
			{viewModel.emptyMessage ? <div className='text-secondary text-xs'>{viewModel.emptyMessage}</div> : null}
			<div className='flex items-center gap-2 max-sm:flex-col'>
				<input
					type='text'
					value={createdFolderInput}
					onChange={event => setCreatedFolderInput(event.target.value)}
					placeholder='新建目录，例如：设计/图片工具'
					className={inputClassName}
				/>
				<button type='button' onClick={handleCreateFolder} disabled={!viewModel.nextValueAfterCreate} className={buttonClassName}>
					{createButtonLabel}
				</button>
			</div>
		</div>
	)
}
