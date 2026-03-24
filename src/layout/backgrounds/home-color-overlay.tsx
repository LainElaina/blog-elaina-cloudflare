'use client'

import { usePathname } from 'next/navigation'
import siteContent from '@/config/site-content.json'
import BlurredBubblesBackground from './blurred-bubbles'

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
	const motion = theme?.homeColorOverlayMotion ?? 'dynamic'
	const solidColor = /^#(?:[0-9a-fA-F]{6})$/.test(theme?.colorBrand ?? '') ? `${theme?.colorBrand}26` : 'rgba(53, 191, 171, 0.15)'

	if (mode === 'solid') {
		return <div aria-hidden='true' className='pointer-events-none fixed inset-0 z-0' style={{ backgroundColor: solidColor }} />
	}

	if (motion === 'static') {
		const c0 = backgroundColors[0] ?? '#EDDD62'
		const c1 = backgroundColors[1] ?? '#9EE7D1'
		const c2 = backgroundColors[2] ?? '#84D68A'
		return (
			<div
				aria-hidden='true'
				className='pointer-events-none fixed inset-0 z-0 overflow-hidden'
				style={{ filter: 'blur(50px)' }}>
				<div className='absolute rounded-full' style={{ width: '34vmax', height: '34vmax', left: '-4%', bottom: '-8%', background: c0, opacity: 0.48 }} />
				<div className='absolute rounded-full' style={{ width: '38vmax', height: '38vmax', left: '28%', bottom: '-12%', background: c1, opacity: 0.42 }} />
				<div className='absolute rounded-full' style={{ width: '30vmax', height: '30vmax', right: '-5%', bottom: '-6%', background: c2, opacity: 0.4 }} />
			</div>
		)
	}

	return <BlurredBubblesBackground colors={backgroundColors} count={6} bottomBandStart={0.8} regenerateKey={0} />
}
