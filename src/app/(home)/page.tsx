'use client'

import { LayoutSavePanel } from './layout-save-panel'
import { useSize } from '@/hooks/use-size'
import { useConfigStore } from './stores/config-store'
import { useCustomComponentStore } from './stores/custom-component-store'
import ConfigDialog from './config-dialog/index'
import { useEffect } from 'react'
import SnowfallBackground from '@/layout/backgrounds/snowfall'
import { COMPONENT_REGISTRY } from '@/config/component-registry'
import { CustomCard } from '@/components/custom-card'
import { EditLayoutButton } from '@/components/edit-layout-button'
import { ExportLayoutButton } from '@/components/export-layout-button'
import { ImportLayoutButton } from '@/components/import-layout-button'
import { LayoutSettingsButton } from '@/components/layout-settings-button'
import { ComponentStore } from '@/components/component-store'

export default function Home() {
	const { maxSM } = useSize()
	const { cardStyles, configDialogOpen, setConfigDialogOpen, siteContent } = useConfigStore()
	const { components: customComponents } = useCustomComponentStore()

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.ctrlKey || e.metaKey) && (e.key === 'l' || e.key === ',')) {
				e.preventDefault()
				setConfigDialogOpen(true)
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => {
			window.removeEventListener('keydown', handleKeyDown)
		}
	}, [setConfigDialogOpen])

	return (
		<>
			{siteContent.enableChristmas && <SnowfallBackground zIndex={0} count={!maxSM ? 125 : 20} />}

			<LayoutSavePanel />
			<ComponentStore />
			<EditLayoutButton />
			<ExportLayoutButton />
			<ImportLayoutButton />
			<LayoutSettingsButton />

			<div className='max-sm:flex max-sm:flex-col max-sm:items-center max-sm:gap-6 max-sm:pt-28 max-sm:pb-20'>
				{Object.entries(COMPONENT_REGISTRY).map(([id, meta]) => {
					const style = cardStyles[id as keyof typeof cardStyles]
					if (!style || style.enabled === false) return null

					if (meta.desktopOnly && maxSM) return null
					if (meta.mobileOnly && !maxSM) return null

					const Component = meta.component
					return <Component key={id} />
				})}
				{customComponents.filter(c => c.style.enabled).map((comp, i) => (
					<CustomCard key={comp.id} component={comp} index={i} />
				))}
			</div>

			{siteContent.enableChristmas && <SnowfallBackground zIndex={2} count={!maxSM ? 125 : 20} />}
			<ConfigDialog open={configDialogOpen} onClose={() => setConfigDialogOpen(false)} />
		</>
	)
}
