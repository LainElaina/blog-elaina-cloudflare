'use client'

import { CustomComponent } from '../app/(home)/stores/custom-component-store'

interface CustomCardProps {
	component: CustomComponent
}

export function CustomCard({ component }: CustomCardProps) {
	const { type, content } = component

	return (
		<div className='card squircle p-4'>
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

			{type === 'custom' && content.html && (
				<div dangerouslySetInnerHTML={{ __html: content.html }} />
			)}
		</div>
	)
}
