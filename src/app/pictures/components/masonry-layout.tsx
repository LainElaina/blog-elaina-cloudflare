'use client'

import { useState, useMemo } from 'react'
import { motion } from 'motion/react'
import type { Picture } from '../page'
import Lightbox from '@/components/lightbox'

interface MasonryLayoutProps {
	pictures: Picture[]
	isEditMode?: boolean
	onDeleteSingle?: (pictureId: string, imageIndex: number | 'single') => void
	onDeleteGroup?: (picture: Picture) => void
}

type UrlItem = {
	url: string
	description?: string
	uploadedAt?: string
	pictureId: string
	imageIndex: number | 'single'
}

const buildUrlList = (pictures: Picture[]): UrlItem[] => {
	const result: UrlItem[] = []
	for (const picture of pictures) {
		if (picture.image) {
			result.push({
				url: picture.image,
				description: picture.description,
				uploadedAt: picture.uploadedAt,
				pictureId: picture.id,
				imageIndex: 'single'
			})
		}
		if (picture.images && picture.images.length > 0) {
			result.push(
				...picture.images.map((url, imageIndex) => ({
					url,
					description: picture.description,
					uploadedAt: picture.uploadedAt,
					pictureId: picture.id,
					imageIndex: imageIndex
				}))
			)
		}
	}
	return result
}

export function MasonryLayout({ pictures, isEditMode = false, onDeleteSingle }: MasonryLayoutProps) {
	const urls = useMemo(() => buildUrlList(pictures), [pictures])
	const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
	const [lightboxAlt, setLightboxAlt] = useState('')

	if (!urls.length) return null

	return (
		<>
			<div className='columns-2 gap-4 p-6 pt-20 pb-24 md:columns-3 lg:columns-4'>
				{urls.map((item, index) => (
					<motion.div
						key={`${item.pictureId}-${item.imageIndex}`}
						initial={{ opacity: 0, y: 16 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.5) }}
						className='group relative mb-4 break-inside-avoid overflow-hidden'
						style={{
							borderRadius: 'var(--card-inner-radius)',
							background: 'var(--card-bg)',
							border: '1px solid var(--card-border-color)'
						}}>
						<img
							src={item.url}
							alt={item.description || ''}
							loading='lazy'
							className='w-full cursor-pointer object-cover transition-transform duration-300 hover:scale-105'
							onClick={() => {
								if (!isEditMode) {
									setLightboxSrc(item.url)
									setLightboxAlt(item.description || '')
								}
							}}
						/>

						{/* Description overlay */}
						{item.description && !isEditMode && (
							<div className='pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-3 pt-8 opacity-0 transition-opacity group-hover:opacity-100'>
								<p className='text-xs text-white'>{item.description}</p>
							</div>
						)}

						{/* Edit mode delete button */}
						{isEditMode && (
							<motion.button
								initial={{ opacity: 0, scale: 0.8 }}
								animate={{ opacity: 1, scale: 1 }}
								onClick={() => onDeleteSingle?.(item.pictureId, item.imageIndex)}
								className='absolute top-2 right-2 rounded-full bg-red-500 p-1.5 shadow-lg transition-all hover:scale-105 hover:bg-red-600'
								aria-label='删除图片'>
								<svg xmlns='http://www.w3.org/2000/svg' className='size-3 text-white' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
									<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
								</svg>
							</motion.button>
						)}
					</motion.div>
				))}
			</div>

			<Lightbox src={lightboxSrc} alt={lightboxAlt} onClose={() => setLightboxSrc(null)} />
		</>
	)
}
