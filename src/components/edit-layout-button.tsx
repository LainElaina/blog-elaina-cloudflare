'use client'

import { Edit } from 'lucide-react'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useConfigStore } from '../app/(home)/stores/config-store'
import { useLayoutEditStore } from '../app/(home)/stores/layout-edit-store'
import { useCenterStore } from '@/hooks/use-center'
import DraggerSVG from '@/svgs/dragger.svg'
import { InfoDialog } from './info-dialog'

export function EditLayoutButton() {
	const [mounted, setMounted] = useState(false)
	const [showInfo, setShowInfo] = useState(false)
	const { cardStyles } = useConfigStore()
	const editing = useLayoutEditStore(state => state.editing)
	const startEditing = useLayoutEditStore(state => state.startEditing)
	const setOffset = useLayoutEditStore(state => state.setOffset)
	const center = useCenterStore()

	const styles = cardStyles.editLayoutButton
	const x = styles?.offsetX !== null ? center.x + (styles?.offsetX || 0) : window.innerWidth - 24 - 48 - 72 - 72
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
			setOffset('editLayoutButton', dragStateRef.current.initialOffsetX + dx, dragStateRef.current.initialOffsetY + dy)
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

	const handleConfirmEdit = () => {
		startEditing()
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
					title='进入拖拽布局'
					disabled={editing}
				>
					<Edit className='w-5 h-5 text-brand' />
				</button>
			</div>

			<InfoDialog open={showInfo} onClose={() => setShowInfo(false)} title='进入拖拽布局'>
				<p>进入编辑模式后，你可以：</p>
				<ul className='list-disc list-inside space-y-1 ml-2'>
					<li>拖拽任意卡片调整位置</li>
					<li>拖拽卡片右下角调整大小</li>
					<li>拖拽按钮调整工具栏位置</li>
				</ul>
				<p className='mt-3'>编辑完成后，点击底部的"保存"按钮保存布局。</p>
				<div className='mt-4 flex gap-2'>
					<button onClick={handleConfirmEdit} className='flex-1 px-4 py-2 bg-brand text-white rounded-lg hover:opacity-90'>
						开始编辑
					</button>
					<button onClick={() => setShowInfo(false)} className='flex-1 px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300'>
						取消
					</button>
				</div>
			</InfoDialog>
		</>
	)
}
