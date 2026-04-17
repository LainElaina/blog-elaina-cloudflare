'use client'

import { type LogoItem } from './components/logo-upload-dialog'
import { ShareCard, type Share } from './components/share-card'
import { SHARE_CATEGORY_ALL } from './share-runtime'

interface GridViewProps {
	shares: Share[]
	searchTerm: string
	onSearchTermChange: (value: string) => void
	selectedTag: string
	tagOptions: string[]
	onSelectTag: (tag: string) => void
	emptyMessage?: string
	isEditMode?: boolean
	onUpdate?: (share: Share, oldShare: Share, logoItem?: LogoItem) => void
	onDelete?: (share: Share) => void
}

export default function GridView({
	shares,
	searchTerm,
	onSearchTermChange,
	selectedTag,
	tagOptions,
	onSelectTag,
	emptyMessage = '没有找到相关资源',
	isEditMode = false,
	onUpdate,
	onDelete
}: GridViewProps) {
	return (
		<div className='space-y-6'>
			<div className='space-y-4'>
				<input
					type='text'
					placeholder='搜索资源...'
					value={searchTerm}
					onChange={e => onSearchTermChange(e.target.value)}
					className='focus:ring-brand block w-full max-w-md rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:outline-none'
				/>

				<div className='flex flex-wrap gap-2'>
					<button
						type='button'
						onClick={() => onSelectTag(SHARE_CATEGORY_ALL)}
						className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
							selectedTag === SHARE_CATEGORY_ALL ? 'bg-brand text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
						}`}>
						全部
					</button>
					{tagOptions.map(tag => (
						<button
							key={tag}
							type='button'
							onClick={() => onSelectTag(tag)}
							className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
								selectedTag === tag ? 'bg-brand text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
							}`}>
							{tag}
						</button>
					))}
				</div>
			</div>

			<div className='grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3'>
				{shares.map(share => (
					<ShareCard key={share.url} share={share} isEditMode={isEditMode} onUpdate={onUpdate} onDelete={() => onDelete?.(share)} />
				))}
			</div>

			{shares.length === 0 && (
				<div className='mt-12 text-center text-gray-500'>
					<p>{emptyMessage}</p>
				</div>
			)}
		</div>
	)
}
