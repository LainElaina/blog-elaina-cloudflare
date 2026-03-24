'use client'

import { LayoutGrid } from 'lucide-react'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useConfigStore } from '../app/(home)/stores/config-store'
import { useLayoutEditStore } from '../app/(home)/stores/layout-edit-store'
import { useCenterStore } from '@/hooks/use-center'
import DraggerSVG from '@/svgs/dragger.svg'
import { LayoutDialog } from './layout-dialog'

export function LayoutSettingsButton() {
	const [mounted, setMounted] = useState(false)
	const [showDialog, setShowDialog] = useState(false)
	const { cardStyles } = useConfigStore()
	const editing = useLayoutEditStore(state => state.editing)
	const setOffset = useLayoutEditStore(state => state.setOffset)
	const center = useCenterStore()

	const styles = cardStyles.layoutSettingsButton
	const x = styles?.offsetX !== null ? center.x + (styles?.offsetX || 0) : window.innerWidth - 24 - 48 - 72 - 72 - 72 - 72 - 72
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
			setOffset('layoutSettingsButton', dragStateRef.current.initialOffsetX + dx, dragStateRef.current.initialOffsetY + dy)
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
		setShowDialog(true)
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
					title='首页布局'
				>
					<LayoutGrid className='w-5 h-5 text-brand' />
				</button>
			</div>

			<LayoutDialog open={showDialog} onClose={() => setShowDialog(false)} />
		</>
	)
}
