'use client'

import { create } from 'zustand'
import { useConfigStore, type CardStyles } from './config-store'
import { useCustomComponentStore } from './custom-component-store'
import { useLogStore } from './log-store'

type CardKey = keyof CardStyles | string

interface LayoutEditState {
	editing: boolean
	snapshot: CardStyles | null
	startEditing: () => void
	stopEditing: () => void
	cancelEditing: () => void
	saveEditing: () => void
	setOffset: (key: CardKey, offsetX: number | null, offsetY: number | null) => void
	setSize: (key: CardKey, width: number | undefined, height: number | undefined) => void
}

export const useLayoutEditStore = create<LayoutEditState>((set, get) => ({
	editing: false,
	snapshot: null,
	startEditing: () => {
		const { cardStyles } = useConfigStore.getState()
		set({
			editing: true,
			snapshot: { ...cardStyles }
		})
		useLogStore.getState().addLog('info', 'layout', '开始编辑布局')
	},
	stopEditing: () => {
		set({
			editing: false,
			snapshot: null
		})
		useLogStore.getState().addLog('info', 'layout', '结束编辑布局')
	},
	cancelEditing: () => {
		const { snapshot } = get()
		if (!snapshot) {
			set({ editing: false, snapshot: null })
			return
		}

		const { setCardStyles } = useConfigStore.getState()
		setCardStyles(snapshot)

		set({
			editing: false,
			snapshot: null
		})
		useLogStore.getState().addLog('warning', 'layout', '取消编辑布局，已恢复快照')
	},
	saveEditing: () => {
		set({
			editing: false,
			snapshot: null
		})
		useLogStore.getState().addLog('success', 'layout', '保存编辑布局')
	},
	setOffset: (key, offsetX, offsetY) => {
		const { cardStyles, setCardStyles } = useConfigStore.getState()

		// 检查是否是自定义组件
		if (typeof key === 'string' && key.startsWith('custom-')) {
			const { components, updateComponent } = useCustomComponentStore.getState()
			const comp = components.find(c => c.id === key)
			if (comp) {
				updateComponent(key, {
					style: { ...comp.style, offsetX, offsetY }
				})
			}
			return
		}

		const next: CardStyles = {
			...cardStyles,
			[key]: {
				...cardStyles[key as keyof CardStyles],
				offsetX,
				offsetY
			}
		}

		setCardStyles(next)
	},
	setSize: (key, width, height) => {
		const { cardStyles, setCardStyles } = useConfigStore.getState()

		// 检查是否是自定义组件
		if (typeof key === 'string' && key.startsWith('custom-')) {
			const { components, updateComponent } = useCustomComponentStore.getState()
			const comp = components.find(c => c.id === key)
			if (comp && width !== undefined && height !== undefined) {
				updateComponent(key, {
					style: { ...comp.style, width, height }
				})
			}
			return
		}

		const next: CardStyles = {
			...cardStyles,
			[key as keyof CardStyles]: {
				...cardStyles[key as keyof CardStyles],
				...(width !== undefined && { width }),
				...(height !== undefined && { height })
			}
		}

		setCardStyles(next)
	}
}))

