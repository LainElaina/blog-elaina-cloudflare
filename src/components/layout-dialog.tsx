'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { useConfigStore, type CardStyles } from '../app/(home)/stores/config-store'
import { HomeLayout } from '../app/(home)/config-dialog/home-layout'

interface LayoutDialogProps {
	open: boolean
	onClose: () => void
}

export function LayoutDialog({ open, onClose }: LayoutDialogProps) {
	const { cardStyles, setCardStyles } = useConfigStore()
	const [cardStylesData, setCardStylesData] = useState<CardStyles>(cardStyles)

	const handleOpen = () => {
		setCardStylesData({ ...cardStyles })
	}

	const handleApply = () => {
		setCardStyles(cardStylesData)
	}

	const handleClose = () => {
		onClose()
	}

	return (
		<AnimatePresence>
			{open && (
				<>
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className='fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999]'
						onClick={handleClose}
						onAnimationStart={handleOpen}
					/>
					<motion.div
						initial={{ opacity: 0, scale: 0.95, y: 10 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.95, y: 10 }}
						className='fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[10000]
							w-[640px] max-w-[90vw] max-h-[80vh] overflow-y-auto scrollbar-none
							rounded-3xl bg-white/60 backdrop-blur-xl border border-white/20 shadow-2xl p-6'
					>
						<div className='flex items-center justify-between mb-5'>
							<h3 className='text-lg font-semibold'>首页布局</h3>
							<button
								onClick={handleClose}
								className='p-1.5 rounded-full hover:bg-white/30 transition-colors'
							>
								<X className='w-4 h-4 text-secondary' />
							</button>
						</div>

						<HomeLayout cardStylesData={cardStylesData} setCardStylesData={setCardStylesData} onClose={handleClose} />

						<div className='mt-5 flex justify-end gap-3'>
							<motion.button
								whileHover={{ scale: 1.03 }}
								whileTap={{ scale: 0.97 }}
								onClick={handleClose}
								className='px-5 py-2 text-sm rounded-full bg-white/30 hover:bg-white/50 transition-colors'
							>
								取消
							</motion.button>
							<motion.button
								whileHover={{ scale: 1.03 }}
								whileTap={{ scale: 0.97 }}
								onClick={() => { handleApply(); handleClose() }}
								className='px-5 py-2 text-sm rounded-full bg-brand text-white hover:opacity-90 transition-opacity'
							>
								应用
							</motion.button>
						</div>
					</motion.div>
				</>
			)}
		</AnimatePresence>
	)
}
