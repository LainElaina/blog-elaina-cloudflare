'use client'

import { Upload } from 'lucide-react'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useConfigStore } from '../app/(home)/stores/config-store'
import { useLayoutEditStore } from '../app/(home)/stores/layout-edit-store'
import { useCenterStore } from '@/hooks/use-center'
import { toast } from 'sonner'
import DraggerSVG from '@/svgs/dragger.svg'
import { InfoDialog } from './info-dialog'

export function ImportLayoutButton() {
	const [mounted, setMounted] = useState(false)
	const [showInfo, setShowInfo] = useState(false)
	const { cardStyles } = useConfigStore()
	const editing = useLayoutEditStore(state => state.editing)
	const setOffset = useLayoutEditStore(state => state.setOffset)
	const center = useCenterStore()

	const styles = cardStyles.importLayoutButton
	const x = styles?.offsetX !== null ? center.x + (styles?.offsetX || 0) : window.innerWidth - 24 - 48 - 72 - 72 - 72
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
			setOffset('importLayoutButton', dragStateRef.current.initialOffsetX + dx, dragStateRef.current.initialOffsetY + dy)
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

	const handleConfirmImport = () => {
		const input = document.createElement('input')
		input.type = 'file'
		input.accept = '.json'
		input.onchange = async (e: any) => {
			const file = e.target?.files?.[0]
			if (!file) return
			try {
				const text = await file.text()
				const config = JSON.parse(text)

				if (config.cardStyles) {
					useConfigStore.getState().setCardStyles(config.cardStyles)
				}
				if (config.customComponents) {
					localStorage.setItem('custom-components', JSON.stringify(config.customComponents))
				}
				if (config.componentFavorites) {
					localStorage.setItem('component-favorites', JSON.stringify(config.componentFavorites))
				}
				if (config.templates) {
					localStorage.setItem('templates', JSON.stringify(config.templates))
				}

				window.location.reload()
				toast.success('布局配置已导入')
			} catch (error) {
				toast.error('导入失败，请检查文件格式')
			}
		}
		input.click()
		setShowInfo(false)
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
					title='导入布局配置'
				>
					<Upload className='w-5 h-5 text-brand' />
				</button>
			</div>

			<InfoDialog open={showInfo} onClose={() => setShowInfo(false)} title='导入布局配置'>
				<p>导入配置文件将会：</p>
				<ul className='list-disc list-inside space-y-1 ml-2'>
					<li>替换当前的所有布局设置</li>
					<li>替换自定义组件</li>
					<li>替换收藏的组件模板</li>
					<li>替换布局模板</li>
				</ul>
				<p className='mt-2 text-xs text-secondary'>注意：不包含图片类型组件已上传的图片文件，仅导入图片路径（网络链接可正常使用）。</p>
				<p className='mt-3 text-orange-600 font-medium'>建议先导出当前配置作为备份</p>
				<div className='mt-4 flex gap-2'>
					<button onClick={handleConfirmImport} className='flex-1 px-4 py-2 bg-brand text-white rounded-lg hover:opacity-90'>
						选择文件导入
					</button>
					<button onClick={() => setShowInfo(false)} className='flex-1 px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300'>
						取消
					</button>
				</div>
			</InfoDialog>
		</>
	)
}
