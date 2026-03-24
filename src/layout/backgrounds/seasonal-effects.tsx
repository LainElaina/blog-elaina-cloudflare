'use client'

import { useMemo } from 'react'
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
	light: { count: 18, opacity: 0.45 },
	mixed: { count: 30, opacity: 0.65 },
	vivid: { count: 44, opacity: 0.85 }
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
	const particles = useMemo(
		() =>
			Array.from({ length: count }, (_, i) => ({
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
			})),
		[count, colors, driftRange, durationRange, sizeRange]
	)

	return (
		<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }} className='pointer-events-none fixed inset-0 z-0 overflow-hidden'>
			{particles.map(p => (
				<motion.div
					key={p.id}
					className='absolute'
					style={{ left: `${p.left}%`, top: `${p.top}%`, width: p.size, height: p.size, opacity }}
					initial={{ x: 0, y: 0, rotate: p.rotate }}
					animate={{ x: [0, p.driftX, 0], y: [0, p.driftY, 0], rotate: rotate ? [p.rotate, p.rotate + 80, p.rotate + 160] : p.rotate }}
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
		const count = style === 'light' ? 36 : style === 'mixed' ? 72 : 110
		return <SnowfallBackground zIndex={0} count={count} />
	}

	if (season === 'spring') {
		return (
			<FloatingParticles
				count={preset.count}
				opacity={preset.opacity}
				colors={['#ffd1dc', '#ffe4e1', '#fff0f5']}
				sizeRange={[10, 22]}
				durationRange={[10, 18]}
				driftRange={[-36, 36]}
				rotate
				shape='petal'
			/>
		)
	}

	if (season === 'summer') {
		return (
			<FloatingParticles
				count={style === 'vivid' ? preset.count + 10 : preset.count}
				opacity={Math.min(0.95, preset.opacity + 0.05)}
				colors={['#ffe066', '#ffd43b', '#9bf6ff', '#b9fbc0']}
				sizeRange={[8, 18]}
				durationRange={[6, 12]}
				driftRange={[-22, 22]}
				shape='circle'
			/>
		)
	}

	return (
		<FloatingParticles
			count={preset.count}
			opacity={preset.opacity}
			colors={['#f4a261', '#e76f51', '#e9c46a', '#c97b63']}
			sizeRange={[12, 24]}
			durationRange={[9, 16]}
			driftRange={[-28, 28]}
			rotate
			shape='leaf'
		/>
	)
}
