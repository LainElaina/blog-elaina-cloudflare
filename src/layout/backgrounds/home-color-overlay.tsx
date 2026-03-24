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
	const solidColor = /^#(?:[0-9a-fA-F]{6})$/.test(theme?.colorBrand ?? '') ? `${theme?.colorBrand}26` : 'rgba(53, 191, 171, 0.15)'

	if (mode === 'solid') {
		return <div aria-hidden='true' className='pointer-events-none fixed inset-0 z-0' style={{ backgroundColor: solidColor }} />
	}

	return <BlurredBubblesBackground colors={backgroundColors} count={6} bottomBandStart={0.8} regenerateKey={0} />
}
