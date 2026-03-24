'use client'
import { PropsWithChildren } from 'react'
import { useCenterInit } from '@/hooks/use-center'
import CssBlurBackground from './backgrounds/css-blur-background'
import HomeColorOverlay from './backgrounds/home-color-overlay'
import SeasonalEffects from './backgrounds/seasonal-effects'
import NavCard from '@/components/nav-card'
import MobileBottomNav from '@/components/mobile-bottom-nav'
import { Toaster } from 'sonner'
import { CircleCheckIcon, InfoIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon } from 'lucide-react'
import { useSize, useSizeInit } from '@/hooks/use-size'
import { useConfigStore } from '@/app/(home)/stores/config-store'
import { ScrollTopButton } from '@/components/scroll-top-button'
import MusicCard from '@/components/music-card'
import { LogWindow } from '@/app/(home)/log-window'
import { LogButton } from '@/components/log-button'
import { GlobalErrorHandler } from '@/components/global-error-handler'

export default function Layout({ children }: PropsWithChildren) {
	useCenterInit()
	useSizeInit()
	const { cardStyles, siteContent } = useConfigStore()
	const { maxSM, init } = useSize()

	const backgroundImages = (siteContent.backgroundImages ?? []) as Array<{ id: string; url: string }>
	const currentBackgroundImageId = siteContent.currentBackgroundImageId
	const currentBackgroundImage =
		currentBackgroundImageId && currentBackgroundImageId.trim() ? backgroundImages.find(item => item.id === currentBackgroundImageId) : null

	return (
		<>
			<Toaster
				position='bottom-right'
				richColors
				icons={{
					success: <CircleCheckIcon className='size-4' />,
					info: <InfoIcon className='size-4' />,
					warning: <TriangleAlertIcon className='size-4' />,
					error: <OctagonXIcon className='size-4' />,
					loading: <Loader2Icon className='size-4 animate-spin' />
				}}
				style={
					{
						'--border-radius': '12px'
					} as React.CSSProperties
				}
			/>
			{currentBackgroundImage && (
				<div
					className='fixed inset-0 z-0 overflow-hidden'
					style={{
						backgroundImage: `url(${currentBackgroundImage.url})`,
						backgroundSize: 'cover',
						backgroundPosition: 'center',
						backgroundRepeat: 'no-repeat'
					}}
				/>
			)}
			<CssBlurBackground colors={siteContent.backgroundColors} />
			<HomeColorOverlay theme={siteContent.theme} backgroundColors={siteContent.backgroundColors} />
			<SeasonalEffects theme={siteContent.theme} />

			<GlobalErrorHandler />
			<LogWindow />
			<LogButton />

			<main className='relative z-10 h-full'>
				{children}
				{/* Desktop: NavCard sidebar/icons, Mobile: bottom nav */}
				{!maxSM && <NavCard />}

				{!maxSM && cardStyles.musicCard?.enabled !== false && <MusicCard />}
			</main>

			{/* Mobile bottom navigation */}
			{maxSM && init && <MobileBottomNav />}

			{maxSM && init && <ScrollTopButton className='bg-brand/20 fixed right-6 bottom-20 z-50 shadow-md' />}
		</>
	)
}
