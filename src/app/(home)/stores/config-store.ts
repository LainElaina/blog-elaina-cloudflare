import { create } from 'zustand'
import siteContent from '@/config/site-content.json'
import cardStyles from '@/config/card-styles.json'
import cardStylesDefault from '@/config/card-styles-default.json'
import { saveLayoutToServer, undoLayout } from '@/lib/layout-persistence'

export type SiteContent = typeof siteContent
export type CardStyles = typeof cardStyles

interface ConfigStore {
	siteContent: SiteContent
	cardStyles: CardStyles
	regenerateKey: number
	configDialogOpen: boolean
	setSiteContent: (content: SiteContent) => void
	setCardStyles: (styles: CardStyles) => void
	resetSiteContent: () => void
	resetCardStyles: () => void
	regenerateBubbles: () => void
	setConfigDialogOpen: (open: boolean) => void
	saveLayout: () => Promise<void>
	undoLayout: () => Promise<void>
}

export const useConfigStore = create<ConfigStore>((set, get) => ({
	siteContent: { ...siteContent },
	cardStyles: { ...cardStyles },
	regenerateKey: 0,
	configDialogOpen: false,
	setSiteContent: (content: SiteContent) => {
		set({ siteContent: content })
	},
	setCardStyles: (styles: CardStyles) => {
		set({ cardStyles: styles })
	},
	resetSiteContent: () => {
		set({ siteContent: { ...siteContent } })
	},
	resetCardStyles: () => {
		set({ cardStyles: { ...cardStylesDefault } as CardStyles })
	},
	regenerateBubbles: () => {
		set(state => ({ regenerateKey: state.regenerateKey + 1 }))
	},
	setConfigDialogOpen: (open: boolean) => {
		set({ configDialogOpen: open })
	},
	saveLayout: async () => {
		const { cardStyles } = get()
		try {
			await saveLayoutToServer(cardStyles)
		} catch (error) {
			console.error('Failed to save layout:', error)
		}
	},
	undoLayout: async () => {
		try {
			await undoLayout()
			// 重新加载页面以应用撤销的布局
			window.location.reload()
		} catch (error) {
			console.error('Failed to undo layout:', error)
		}
	}
}))

