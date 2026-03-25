'use client'

import { useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { createPortal } from 'react-dom'
import { XIcon } from 'lucide-react'

interface LightboxProps {
	src: string | null
	alt?: string
	onClose: () => void
}

export default function Lightbox({ src, alt = '', onClose }: LightboxProps) {
	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose()
		},
		[onClose]
	)

	useEffect(() => {
		if (src) {
			document.addEventListener('keydown', handleKeyDown)
			document.body.style.overflow = 'hidden'
			return () => {
				document.removeEventListener('keydown', handleKeyDown)
				document.body.style.overflow = ''
			}
		}
	}, [src, handleKeyDown])

	if (typeof window === 'undefined') return null

	return createPortal(
		<AnimatePresence>
			{src && (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.2 }}
					className='fixed inset-0 z-[100] flex items-center justify-center p-4'
					style={{
						background: 'rgba(0, 0, 0, 0.75)',
						backdropFilter: 'blur(8px)'
					}}
					onClick={onClose}
					role='dialog'
					aria-modal='true'
					aria-label='图片预览'>
					{/* Close button */}
					<button
						onClick={onClose}
						className='fixed top-4 right-4 z-10 rounded-full bg-white/20 p-2 transition-colors hover:bg-white/30'
						aria-label='关闭预览'>
						<XIcon className='size-6 text-white' />
					</button>

					<motion.img
						initial={{ scale: 0.9, opacity: 0 }}
						animate={{ scale: 1, opacity: 1 }}
						exit={{ scale: 0.9, opacity: 0 }}
						transition={{ duration: 0.2 }}
						src={src}
						alt={alt}
						className='max-h-[90vh] max-w-full object-contain'
						style={{ borderRadius: 'var(--card-inner-radius)' }}
						onClick={e => e.stopPropagation()}
					/>
				</motion.div>
			)}
		</AnimatePresence>,
		document.body
	)
}
