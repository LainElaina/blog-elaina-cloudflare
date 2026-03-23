import { create } from 'zustand'
import siteContent from '@/config/site-content.json'
import cardStyles from '@/config/card-styles.json'
import cardStylesDefault from '@/config/card-styles-default.json'
import { saveLayoutToServer, undoLayout } from '@/lib/layout-persistence'
import { useLogStore } from './log-store'

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
		useLogStore.getState().addLog('info', '设置站点内容')
	},
	setCardStyles: (styles: CardStyles) => {
		set({ cardStyles: styles })
		useLogStore.getState().addLog('info', '设置卡片样式')
	},
	resetSiteContent: () => {
		set({ siteContent: { ...siteContent } })
		useLogStore.getState().addLog('warning', '重置站点内容为默认值')
	},
	resetCardStyles: () => {
		set({ cardStyles: { ...cardStylesDefault } as CardStyles })
		useLogStore.getState().addLog('warning', '重置卡片样式为默认值')
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

