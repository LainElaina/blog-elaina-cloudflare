'use client'

import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'

interface InfoDialogProps {
	open: boolean
	onClose: () => void
	title: string
	children: React.ReactNode
}

export function InfoDialog({ open, onClose, title, children }: InfoDialogProps) {
	return (
		<AnimatePresence>
			{open && (
				<>
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className='fixed inset-0 bg-black/50 z-[9999]'
						onClick={onClose}
					/>
					<motion.div
						initial={{ opacity: 0, scale: 0.95 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 0.95 }}
						className='fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[10000] card squircle p-6 shadow-2xl w-[480px] max-w-[90vw]'
					>
						<div className='flex items-center justify-between mb-4'>
							<h3 className='text-lg font-medium'>{title}</h3>
							<button onClick={onClose} className='p-1 hover:bg-gray-100 rounded'>
								<X className='w-4 h-4' />
							</button>
						</div>
						<div className='text-sm text-gray-600 space-y-3'>
							{children}
						</div>
					</motion.div>
				</>
			)}
		</AnimatePresence>
	)
}
