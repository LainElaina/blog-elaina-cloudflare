'use client'

import { Download } from 'lucide-react'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useConfigStore } from '../app/(home)/stores/config-store'
import { useLayoutEditStore } from '../app/(home)/stores/layout-edit-store'
import { useCenterStore } from '@/hooks/use-center'
import { toast } from 'sonner'
import DraggerSVG from '@/svgs/dragger.svg'
import { InfoDialog } from './info-dialog'

export function ExportLayoutButton() {
	const [mounted, setMounted] = useState(false)
	const [showInfo, setShowInfo] = useState(false)
	const { cardStyles } = useConfigStore()
	const editing = useLayoutEditStore(state => state.editing)
	const setOffset = useLayoutEditStore(state => state.setOffset)
	const center = useCenterStore()

	const styles = cardStyles.exportLayoutButton
	const x = styles?.offsetX !== null ? center.x + (styles?.offsetX || 0) : (typeof window !== 'undefined' ? window.innerWidth - 24 - 48 - 72 - 72 - 72 - 72 : 0)
	const y = styles?.offsetY !== null ? center.y + (styles?.offsetY || 0) : 24

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
			setOffset('exportLayoutButton', dragStateRef.current.initialOffsetX + dx, dragStateRef.current.initialOffsetY + dy)
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

	const handleClick = () => {
		if (editing) return
		setShowInfo(true)
	}

	const handleConfirmExport = () => {
		const customComponents = JSON.parse(localStorage.getItem('custom-components') || '[]')
		const componentFavorites = JSON.parse(localStorage.getItem('component-favorites') || '[]')
		const templates = JSON.parse(localStorage.getItem('templates') || '[]')
		const config = {
			siteContent: useConfigStore.getState().siteContent,
			cardStyles,
			customComponents,
			componentFavorites,
			templates
		}
		const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = `blog-layout-${Date.now()}.json`
		a.click()
		URL.revokeObjectURL(url)
		setShowInfo(false)
		toast.success('布局配置已导出')
	}

	if (!mounted) return null

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
					onClick={handleClick}
					className='card squircle p-3 shadow-2xl hover:scale-105 transition-transform'
					title='导出布局配置'
				>
					<Download className='w-5 h-5 text-brand' />
				</button>
			</div>

			<InfoDialog open={showInfo} onClose={() => setShowInfo(false)} title='导出布局配置'>
				<p>导出的配置文件包含：</p>
				<ul className='list-disc list-inside space-y-1 ml-2'>
					<li>所有卡片的位置、大小和显示设置</li>
					<li>自定义组件及其内容</li>
					<li>收藏的组件模板</li>
					<li>布局模板</li>
					<li>网站主题和样式配置</li>
				</ul>
				<p className='mt-3'>导出后可以分享给他人，或在其他设备上导入使用。</p>
				<p className='mt-2 text-xs text-secondary'>注意：不包含图片类型组件已上传的图片文件，仅保留图片路径（网络链接可正常使用）。</p>
				<div className='mt-4 flex gap-2'>
					<button onClick={handleConfirmExport} className='flex-1 px-4 py-2 bg-brand text-white rounded-lg hover:opacity-90'>
						确认导出
					</button>
					<button onClick={() => setShowInfo(false)} className='flex-1 px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300'>
						取消
					</button>
				</div>
			</InfoDialog>
		</>
	)
}
