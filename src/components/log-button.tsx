'use client'

import { useLogStore, LOG_CATEGORY_LABELS, type LogCategory } from '../app/(home)/stores/log-store'
import { FileText, X } from 'lucide-react'
import { useEffect, useState } from 'react'

export function LogButton() {
	const { enabled, visible, setVisible, setEnabled, enabledCategories, toggleCategory } = useLogStore()
	const [mounted, setMounted] = useState(false)
	const [showSettings, setShowSettings] = useState(false)

	useEffect(() => {
		setMounted(true)
	}, [])

	if (!mounted) return null

	const handleToggleLog = (checked: boolean) => {
		setEnabled(checked)
		if (checked) setVisible(true)
	}

	return (
		<>
			<button
				onClick={() => setShowSettings(!showSettings)}
				className='fixed top-6 right-6 z-[9998] card squircle p-3 shadow-2xl hover:scale-105 transition-transform'
				title='日志设置'
			>
				<FileText className='w-5 h-5 text-brand' />
				{enabled && !visible && (
					<span className='absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse' />
				)}
			</button>

			{showSettings && (
				<div className='fixed top-20 right-6 z-[9999] card squircle p-4 shadow-2xl w-64'>
					<div className='flex items-center justify-between mb-3'>
						<span className='font-medium text-sm'>日志设置</span>
						<button onClick={() => setShowSettings(false)} className='p-1 hover:bg-gray-100 rounded'>
							<X className='w-4 h-4' />
						</button>
					</div>

					<div className='space-y-3'>
						<label className='flex items-center gap-2'>
							<input
								type='checkbox'
								checked={enabled}
								onChange={e => handleToggleLog(e.target.checked)}
							/>
							<span className='text-sm'>启用操作日志</span>
						</label>

						{enabled && (
							<>
								<div className='border-t pt-3'>
									<div className='text-xs text-secondary mb-2'>追踪类型：</div>
									<div className='space-y-2'>
										{(Object.keys(LOG_CATEGORY_LABELS) as LogCategory[]).map(category => (
											<label key={category} className='flex items-center gap-2 text-xs'>
												<input
													type='checkbox'
													checked={enabledCategories.has(category)}
													onChange={() => toggleCategory(category)}
												/>
												<span>{LOG_CATEGORY_LABELS[category]}</span>
											</label>
										))}
									</div>
								</div>

								<button
									onClick={() => {
										setVisible(true)
										setShowSettings(false)
									}}
									className='w-full px-3 py-2 bg-brand text-white rounded-lg text-sm hover:opacity-90'
								>
									打开日志窗口
								</button>
							</>
						)}
					</div>
				</div>
			)}
		</>
	)
}
