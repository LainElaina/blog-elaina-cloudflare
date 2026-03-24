'use client'

import { useLogStore, LOG_CATEGORY_LABELS, type LogCategory } from '../app/(home)/stores/log-store'
import { FileText, X } from 'lucide-react'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useConfigStore } from '../app/(home)/stores/config-store'
import { useLayoutEditStore } from '../app/(home)/stores/layout-edit-store'
import { useCenterStore } from '@/hooks/use-center'
import DraggerSVG from '@/svgs/dragger.svg'

export function LogButton() {
	const { enabled, visible, setVisible, setEnabled, enabledCategories, toggleCategory, hasUnreadError } = useLogStore()
	const [mounted, setMounted] = useState(false)
	const [showSettings, setShowSettings] = useState(false)
	const { cardStyles } = useConfigStore()
	const editing = useLayoutEditStore(state => state.editing)
	const setOffset = useLayoutEditStore(state => state.setOffset)
	const center = useCenterStore()

	const styles = cardStyles.logButton
	const x = styles?.offsetX !== null ? center.x + (styles?.offsetX || 0) : (typeof window !== 'undefined' ? window.innerWidth - 24 - 48 : 0)
	const y = styles?.offsetY !== null ? center.y + (styles?.offsetY || 0) : 24 + 72

	const dragStateRef = useRef({ dragging: false, startX: 0, startY: 0, initialOffsetX: 0, initialOffsetY: 0 })

	const handleMouseDown = useCallback((e: React.MouseEvent) => {
		if (!editing) return
		e.preventDefault()
		e.stopPropagation()
		dragStateRef.current = {
			dragging: true,
			startX: e.clientX,
			startY: e.clientY,
			initialOffsetX: styles?.offsetX ?? (x - center.x),
			initialOffsetY: styles?.offsetY ?? (y - center.y)
		}
	}, [editing, styles, x, y, center])

	useEffect(() => {
		const handleMouseMove = (e: MouseEvent) => {
			if (!dragStateRef.current.dragging) return
			const dx = e.clientX - dragStateRef.current.startX
			const dy = e.clientY - dragStateRef.current.startY
			setOffset('logButton', dragStateRef.current.initialOffsetX + dx, dragStateRef.current.initialOffsetY + dy)
		}

		const handleMouseUp = () => {
			dragStateRef.current.dragging = false
		}

		document.addEventListener('mousemove', handleMouseMove)
		document.addEventListener('mouseup', handleMouseUp)
		return () => {
			document.removeEventListener('mousemove', handleMouseMove)
			document.removeEventListener('mouseup', handleMouseUp)
		}
	}, [setOffset])

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
			<div
				className='fixed z-[9998]'
				style={{ left: x, top: y }}
				onMouseDown={handleMouseDown}
			>
				{editing && (
					<div className='absolute -top-2 -right-2 cursor-move'>
						<DraggerSVG className='w-4 h-4' />
					</div>
				)}
				<button
					onClick={() => !editing && setShowSettings(!showSettings)}
					className='card squircle p-3 shadow-2xl hover:scale-105 transition-transform'
					title='日志设置'
				>
					<FileText className='w-5 h-5 text-brand' />
					{hasUnreadError && (
						<span className='absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse' />
					)}
				</button>
			</div>

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
