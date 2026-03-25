'use client'

import { useState } from 'react'
import Lightbox from '@/components/lightbox'

type MarkdownImageProps = {
	src: string
	alt?: string
	title?: string
}

export function MarkdownImage({ src, alt = '', title = '' }: MarkdownImageProps) {
	const [display, setDisplay] = useState(false)

	return (
		<>
			<img src={src} alt={alt} title={title} loading='lazy' onClick={() => setDisplay(true)} className='cursor-pointer transition-opacity hover:opacity-80' />
			<Lightbox src={display ? src : null} alt={alt} onClose={() => setDisplay(false)} />
		</>
	)
}
