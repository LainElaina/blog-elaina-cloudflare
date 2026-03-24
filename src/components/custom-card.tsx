'use client'

import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'
import { CustomComponent } from '../app/(home)/stores/custom-component-store'
import { HomeDraggableLayer } from '../app/(home)/home-draggable-layer'
import { useCenterStore } from '@/hooks/use-center'
import { useConfigStore } from '../app/(home)/stores/config-store'
import { COMPONENT_REGISTRY } from '@/config/component-registry'
import { ANIMATION_DELAY } from '@/consts'

interface CustomCardProps {
	component: CustomComponent
	index: number
}

export function CustomCard({ component, index }: CustomCardProps) {
	const center = useCenterStore()
	const { cardStyles } = useConfigStore()
	const { type, content, style } = component
	const [show, setShow] = useState(false)

	const x = style.offsetX !== null ? center.x + style.offsetX : center.x - style.width / 2
	const y = style.offsetY !== null ? center.y + style.offsetY : center.y - style.height / 2

	const maxBuiltinOrder = Math.max(
		...Object.keys(COMPONENT_REGISTRY).map(id => {
			const s = cardStyles[id as keyof typeof cardStyles]
			return (s && s.enabled !== false) ? (s.order ?? 0) : 0
		})
	)
	const delayMs = (maxBuiltinOrder + 1 + index) * ANIMATION_DELAY * 1000

	useEffect(() => {
		if (show) return
		if (x === 0 && y === 0) return
		const timer = setTimeout(() => setShow(true), delayMs)
		return () => clearTimeout(timer)
	}, [x, y, show, delayMs])

	if (!show) return null

	// 图片类型：学习首图卡片，用 p-2 + 内圆角
	const isImage = type === 'image' && content.imageUrl
	const cardPadding = isImage ? 'p-2' : 'p-6'

	return (
		<HomeDraggableLayer cardKey={component.id} x={x} y={y} width={style.width} height={style.height}>
			<motion.div
				className={cn('card squircle', cardPadding, 'max-sm:static max-sm:translate-0')}
				initial={{ opacity: 0, scale: 0.6, left: x, top: y, width: style.width, height: style.height }}
				animate={{ opacity: 1, scale: 1, left: x, top: y, width: style.width, height: style.height }}
				whileHover={{ scale: 1.05 }}
				whileTap={{ scale: 0.95 }}>
				{type === 'text' && <div className='text-sm'>{content.text}</div>}

				{isImage && (
					<img
						src={content.imageUrl}
						alt={component.name}
						className='h-full w-full rounded-[32px] object-cover'
					/>
				)}

				{type === 'link' && content.linkUrl && (
					<a href={content.linkUrl} target='_blank' rel='noopener noreferrer' className='text-brand hover:underline'>
						{content.text || content.linkUrl}
					</a>
				)}

				{type === 'iframe' && content.iframeUrl && (
					<iframe src={content.iframeUrl} className='w-full h-full border-0 rounded' />
				)}
			</motion.div>
		</HomeDraggableLayer>
	)
}
