'use client'

import { useEffect, useMemo, useState } from 'react'
import siteContent from '@/config/site-content.json'
import SnowfallBackground from './snowfall'
import { motion } from 'motion/react'
import { getSeasonalLayers, type LayerConfig, type SeasonalStyle, type SeasonalTheme } from './seasonal-effects-config'
import { getParticleAnimation } from './seasonal-effects-render'

type Theme = typeof siteContent.theme

interface SeasonalEffectsProps {
	theme?: Theme
}

interface Particle {
	id: number
	left: number
	top: number
	size: number
	duration: number
	delay: number
	driftX: number
	driftY: number
	color: string
	rotate: number
}

function ParticleShape({ particle, shape }: { particle: Particle; shape: LayerConfig['shape'] }) {
	if (shape === 'bubble') {
		return (
			<div className='relative h-full w-full rounded-full border border-white/50 bg-white/10'>
				<div className='absolute inset-[16%] rounded-full' style={{ backgroundColor: particle.color, opacity: 0.18 }} />
				<div className='absolute left-[18%] top-[12%] h-[26%] w-[26%] rounded-full bg-white/55 blur-[1px]' />
			</div>
		)
	}

	if (shape === 'softGlow') {
		return <div className='h-full w-full rounded-full blur-[12px]' style={{ backgroundColor: particle.color }} />
	}

	if (shape === 'petal') {
		return <div className='h-full w-full rounded-[70%_30%_70%_30%/60%_40%_60%_40%] blur-[1px]' style={{ backgroundColor: particle.color }} />
	}

	if (shape === 'maple') {
		return (
			<div
				className='h-full w-full blur-[0.5px]'
				style={{
					backgroundColor: particle.color,
					clipPath:
						'polygon(50% 0%, 61% 15%, 78% 8%, 73% 27%, 92% 34%, 74% 43%, 84% 62%, 63% 58%, 58% 100%, 50% 82%, 42% 100%, 37% 58%, 16% 62%, 26% 43%, 8% 34%, 27% 27%, 22% 8%, 39% 15%)'
				}}
			/>
		)
	}

	if (shape === 'leaf') {
		return <div className='h-full w-full rounded-[70%_0_70%_0] blur-[1px]' style={{ backgroundColor: particle.color }} />
	}

	return <div className='h-full w-full rounded-full blur-[2px]' style={{ backgroundColor: particle.color }} />
}

function FloatingParticles(layer: LayerConfig) {
	const [mounted, setMounted] = useState(false)

	useEffect(() => {
		setMounted(true)
	}, [])

	const particles = useMemo<Particle[]>(
		() =>
			mounted
				? Array.from({ length: layer.count }, (_, i) => ({
						id: i,
						left: Math.random() * 110 - 5,
						top: Math.random() * 110 - 5,
						size: Math.random() * (layer.sizeRange[1] - layer.sizeRange[0]) + layer.sizeRange[0],
						duration: Math.random() * (layer.durationRange[1] - layer.durationRange[0]) + layer.durationRange[0],
						delay: Math.random() * 8,
						driftX: Math.random() * (layer.driftRange[1] - layer.driftRange[0]) + layer.driftRange[0],
						driftY: Math.random() * (layer.driftRange[1] - layer.driftRange[0]) + layer.driftRange[0],
						color: layer.colors[i % layer.colors.length],
						rotate: Math.random() * 360
				  }))
				: [],
		[layer, mounted]
	)

	if (!mounted) return null

	return (
		<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }} className='pointer-events-none fixed inset-0 z-[1] overflow-hidden'>
			{particles.map(particle => (
				<motion.div
					key={particle.id}
					className='absolute'
					style={{ left: `${particle.left}%`, top: `${particle.top}%`, width: particle.size, height: particle.size, opacity: layer.opacity }}
					initial={{ x: 0, y: 0, rotate: particle.rotate }}
					animate={getParticleAnimation(particle, layer.movement ?? 'float', layer.rotate ?? false)}
					transition={{ duration: particle.duration, delay: particle.delay, repeat: Infinity, ease: 'easeInOut' }}>
					<ParticleShape particle={particle} shape={layer.shape} />
				</motion.div>
			))}
		</motion.div>
	)
}

export default function SeasonalEffects({ theme }: SeasonalEffectsProps) {
	if (!(theme?.enableSeasonalEffects ?? false)) return null

	const season = (theme?.seasonalEffectTheme ?? 'spring') as SeasonalTheme
	const style = (theme?.seasonalEffectStyle ?? 'light') as SeasonalStyle
	const layers = getSeasonalLayers(season, style)

	if (layers.kind === 'winter') {
		return <SnowfallBackground zIndex={0} count={layers.snowCount} />
	}

	return (
		<>
			<FloatingParticles {...layers.secondary} />
			<FloatingParticles {...layers.primary} />
		</>
	)
}
