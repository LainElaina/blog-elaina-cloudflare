'use client'

import { usePathname } from 'next/navigation'
import siteContent from '@/config/site-content.json'
import BlurredBubblesBackground from './blurred-bubbles'
import { getAtmosphereOverlayProfile, normalizeHomeColorOverlayIntensity } from '@/lib/home-color-overlay-intensity'

type Theme = typeof siteContent.theme

interface HomeColorOverlayProps {
	theme?: Theme
	backgroundColors?: string[]
}

export default function HomeColorOverlay({ theme, backgroundColors = [] }: HomeColorOverlayProps) {
	const pathname = usePathname()

	if (pathname !== '/') return null
	if (!(theme?.enableHomeColorOverlay ?? false)) return null

	const mode = theme?.homeColorOverlayMode ?? 'atmosphere'
	const intensity = normalizeHomeColorOverlayIntensity(theme?.homeColorOverlayIntensity)
	const motion = theme?.homeColorOverlayMotion ?? 'dynamic'
	const profile = getAtmosphereOverlayProfile(intensity)
	const solidColor = /^#(?:[0-9a-fA-F]{6})$/.test(theme?.colorBrand ?? '') ? `${theme?.colorBrand}26` : 'rgba(53, 191, 171, 0.15)'

	if (mode === 'solid') {
		return <div aria-hidden='true' className='pointer-events-none fixed inset-0 z-[1]' style={{ backgroundColor: solidColor }} />
	}

	if (motion === 'static') {
		const c0 = backgroundColors[0] ?? '#EDDD62'
		const c1 = backgroundColors[1] ?? '#9EE7D1'
		const c2 = backgroundColors[2] ?? '#84D68A'
		return (
			<div
				aria-hidden='true'
				className='pointer-events-none fixed inset-0 z-[1] overflow-hidden'
				style={{ filter: `blur(${profile.staticBlur}px)` }}>
				<div
					className='absolute rounded-full'
					style={{ width: `${profile.staticBubbles[0].size}vmax`, height: `${profile.staticBubbles[0].size}vmax`, left: profile.staticBubbles[0].left, bottom: profile.staticBubbles[0].bottom, background: c0, opacity: profile.staticBubbles[0].opacity }}
				/>
				<div
					className='absolute rounded-full'
					style={{ width: `${profile.staticBubbles[1].size}vmax`, height: `${profile.staticBubbles[1].size}vmax`, left: profile.staticBubbles[1].left, bottom: profile.staticBubbles[1].bottom, background: c1, opacity: profile.staticBubbles[1].opacity }}
				/>
				<div
					className='absolute rounded-full'
					style={{ width: `${profile.staticBubbles[2].size}vmax`, height: `${profile.staticBubbles[2].size}vmax`, right: profile.staticBubbles[2].right, bottom: profile.staticBubbles[2].bottom, background: c2, opacity: profile.staticBubbles[2].opacity }}
				/>
			</div>
		)
	}

	return <BlurredBubblesBackground colors={backgroundColors} count={profile.dynamicBubbleCount} bottomBandStart={profile.dynamicBottomBandStart} regenerateKey={0} />
}
