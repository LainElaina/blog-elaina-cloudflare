'use client'

import { motion } from 'motion/react'
import siteContent from '@/config/site-content.json'

/**
 * Pure CSS Blurred Background
 * Replaces Canvas-based BlurredBubblesBackground with GPU-accelerated CSS animations.
 * 4 gradient blobs with slow drift animations + noise texture overlay.
 */
export default function CssBlurBackground({
	colors = siteContent.backgroundColors
}: {
	colors?: string[]
}) {
	const c0 = colors[0] || '#EDDD62'
	const c1 = colors[1] || '#9EE7D1'
	const c2 = colors[2] || '#84D68A'
	const c3 = colors[3] || '#88E6E5'

	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			transition={{ duration: 1.5 }}
			className='pointer-events-none fixed inset-0 -z-20 overflow-hidden'
			aria-hidden='true'
		>
			{/* Blob 1 - bottom left */}
			<div
				className='animate-blob-1 absolute rounded-full'
				style={{
					width: '45vmax',
					height: '45vmax',
					bottom: '-10%',
					left: '-5%',
					background: `radial-gradient(circle, ${c0}cc 0%, ${c0}00 70%)`,
					filter: 'blur(80px)'
				}}
			/>

			{/* Blob 2 - bottom center */}
			<div
				className='animate-blob-2 absolute rounded-full'
				style={{
					width: '50vmax',
					height: '50vmax',
					bottom: '-15%',
					left: '25%',
					background: `radial-gradient(circle, ${c1}cc 0%, ${c1}00 70%)`,
					filter: 'blur(80px)'
				}}
			/>

			{/* Blob 3 - bottom right */}
			<div
				className='animate-blob-3 absolute rounded-full'
				style={{
					width: '40vmax',
					height: '40vmax',
					bottom: '-5%',
					right: '-5%',
					background: `radial-gradient(circle, ${c2}cc 0%, ${c2}00 70%)`,
					filter: 'blur(80px)'
				}}
			/>

			{/* Blob 4 - center accent, positioned with calc to avoid transform conflict */}
			<div
				className='animate-blob-4 absolute rounded-full'
				style={{
					width: '35vmax',
					height: '35vmax',
					bottom: '5%',
					left: 'calc(50% - 17.5vmax)',
					background: `radial-gradient(circle, ${c3}99 0%, ${c3}00 70%)`,
					filter: 'blur(90px)'
				}}
			/>

			{/* Subtle noise texture overlay */}
			<div
				className='absolute inset-0'
				style={{
					opacity: 0.015,
					backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
					backgroundSize: '128px 128px'
				}}
			/>
		</motion.div>
	)
}
