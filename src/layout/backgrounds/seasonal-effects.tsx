'use client'

import { useEffect, useMemo, useState } from 'react'
import siteContent from '@/config/site-content.json'
import SnowfallBackground from './snowfall'
import { motion } from 'motion/react'

type Theme = typeof siteContent.theme

type SeasonalTheme = 'spring' | 'summer' | 'autumn' | 'winter'
type SeasonalStyle = 'light' | 'vivid' | 'mixed'

interface SeasonalEffectsProps {
	theme?: Theme
}

const STYLE_PRESETS: Record<SeasonalStyle, { count: number; opacity: number }> = {
	light: { count: 10, opacity: 0.24 },
	mixed: { count: 18, opacity: 0.38 },
	vivid: { count: 34, opacity: 0.68 }
}

function FloatingParticles({ count, opacity, colors, sizeRange, durationRange, driftRange, rotate = false, shape = 'circle' }: {
	count: number
	opacity: number
	colors: string[]
	sizeRange: [number, number]
	durationRange: [number, number]
	driftRange: [number, number]
	rotate?: boolean
	shape?: 'circle' | 'petal' | 'leaf'
}) {
	const [mounted, setMounted] = useState(false)

	useEffect(() => {
		setMounted(true)
	}, [])

	const particles = useMemo(
		() =>
			mounted
				? Array.from({ length: count }, (_, i) => ({
						id: i,
						left: Math.random() * 110 - 5,
						top: Math.random() * 110 - 5,
						size: Math.random() * (sizeRange[1] - sizeRange[0]) + sizeRange[0],
						duration: Math.random() * (durationRange[1] - durationRange[0]) + durationRange[0],
						delay: Math.random() * 8,
						driftX: Math.random() * (driftRange[1] - driftRange[0]) + driftRange[0],
						driftY: Math.random() * (driftRange[1] - driftRange[0]) + driftRange[0],
						color: colors[i % colors.length],
						rotate: Math.random() * 360
				  }))
				: [],
		[count, colors, driftRange, durationRange, mounted, sizeRange]
	)

	if (!mounted) return null

	return (
		<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }} className='pointer-events-none fixed inset-0 z-[1] overflow-hidden'>
			{particles.map(p => (
				<motion.div
					key={p.id}
					className='absolute'
					style={{ left: `${p.left}%`, top: `${p.top}%`, width: p.size, height: p.size, opacity }}
					initial={{ x: 0, y: 0, rotate: p.rotate }}
					animate={{ x: [0, p.driftX, 0], y: [0, p.driftY, 0], rotate: rotate ? [p.rotate, p.rotate + 48, p.rotate + 96] : p.rotate }}
					transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }}>
					{shape === 'circle' && <div className='h-full w-full rounded-full blur-[2px]' style={{ backgroundColor: p.color }} />}
					{shape === 'petal' && <div className='h-full w-full rounded-[70%_30%_70%_30%/60%_40%_60%_40%] blur-[1px]' style={{ backgroundColor: p.color }} />}
					{shape === 'leaf' && <div className='h-full w-full rounded-[70%_0_70%_0] blur-[1px]' style={{ backgroundColor: p.color }} />}
				</motion.div>
			))}
		</motion.div>
	)
}

export default function SeasonalEffects({ theme }: SeasonalEffectsProps) {
	if (!(theme?.enableSeasonalEffects ?? false)) return null

	const season = (theme?.seasonalEffectTheme ?? 'spring') as SeasonalTheme
	const style = (theme?.seasonalEffectStyle ?? 'light') as SeasonalStyle
	const preset = STYLE_PRESETS[style]

	if (season === 'winter') {
		const count = style === 'light' ? 22 : style === 'mixed' ? 42 : 64
		return <SnowfallBackground zIndex={0} count={count} />
	}

	if (season === 'spring') {
		const count = style === 'vivid' ? preset.count + 10 : preset.count
		const opacity = style === 'vivid' ? Math.min(0.82, preset.opacity + 0.1) : preset.opacity
		return (
			<FloatingParticles
				count={count}
				opacity={opacity}
				colors={['#ffb3c7', '#ffc2d1', '#ffd6de']}
				sizeRange={style === 'vivid' ? [10, 20] : [8, 16]}
				durationRange={[14, 24]}
				driftRange={style === 'vivid' ? [-28, 28] : [-20, 20]}
				rotate
				shape='petal'
			/>
		)
	}

	if (season === 'summer') {
		return (
			<FloatingParticles
				count={style === 'vivid' ? preset.count + 6 : preset.count}
				opacity={Math.min(0.68, preset.opacity + 0.04)}
				colors={['#ffe066', '#ffd43b', '#9bf6ff', '#b9fbc0']}
				sizeRange={[6, 14]}
				durationRange={[8, 16]}
				driftRange={[-14, 14]}
				shape='circle'
			/>
		)
	}

	return (
		<FloatingParticles
			count={preset.count}
			opacity={preset.opacity}
			colors={['#f4a261', '#e76f51', '#e9c46a', '#c97b63']}
			sizeRange={[10, 18]}
			durationRange={[12, 20]}
			driftRange={[-18, 18]}
			rotate
			shape='leaf'
		/>
	)
}
