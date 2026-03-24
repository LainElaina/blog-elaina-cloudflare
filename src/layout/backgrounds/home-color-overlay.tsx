'use client'

import { usePathname } from 'next/navigation'
import siteContent from '@/config/site-content.json'

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
	const c0 = backgroundColors[0] ?? theme?.colorBrand ?? '#35bfab'
	const c1 = backgroundColors[1] ?? theme?.colorBrandSecondary ?? c0
	const solidColor = /^#(?:[0-9a-fA-F]{6})$/.test(theme?.colorBrand ?? '') ? `${theme?.colorBrand}26` : 'rgba(53, 191, 171, 0.15)'

	if (mode === 'solid') {
		return <div aria-hidden='true' className='pointer-events-none fixed inset-0 z-0' style={{ backgroundColor: solidColor }} />
	}

	return (
		<div
			aria-hidden='true'
			className='pointer-events-none fixed inset-0 z-0'
			style={{
				background: `radial-gradient(circle at 20% 80%, ${c0}22 0%, transparent 55%), radial-gradient(circle at 75% 25%, ${c1}1f 0%, transparent 50%)`,
				backdropFilter: 'blur(6px)'
			}}
		/>
	)
}
