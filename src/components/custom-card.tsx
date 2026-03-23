'use client'

import { CustomComponent } from '../app/(home)/stores/custom-component-store'
import { HomeDraggableLayer } from '../app/(home)/home-draggable-layer'
import Card from './card'
import { useCenterStore } from '@/hooks/use-center'

interface CustomCardProps {
	component: CustomComponent
}

export function CustomCard({ component }: CustomCardProps) {
	const center = useCenterStore()
	const { type, content, style } = component

	const x = style.offsetX !== null ? center.x + style.offsetX : center.x - style.width / 2
	const y = style.offsetY !== null ? center.y + style.offsetY : center.y - style.height / 2

	return (
		<HomeDraggableLayer cardKey={component.id} x={x} y={y} width={style.width} height={style.height}>
			<Card order={style.order} width={style.width} height={style.height} x={x} y={y} className='max-sm:static max-sm:translate-0'>
				{type === 'text' && <div className='text-sm'>{content.text}</div>}

				{type === 'image' && content.imageUrl && (
					<img src={content.imageUrl} alt={component.name} className='w-full h-full object-cover rounded' />
				)}

				{type === 'link' && content.linkUrl && (
					<a href={content.linkUrl} target='_blank' rel='noopener noreferrer' className='text-brand hover:underline'>
						{content.text || content.linkUrl}
					</a>
				)}

				{type === 'iframe' && content.iframeUrl && (
					<iframe src={content.iframeUrl} className='w-full h-full border-0 rounded' />
				)}
			</Card>
		</HomeDraggableLayer>
	)
}
