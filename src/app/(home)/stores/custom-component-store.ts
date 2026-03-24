import { create } from 'zustand'
import customComponentsDefault from '@/config/custom-components.json'

export interface CustomComponent {
	id: string
	name: string
	type: 'text' | 'image' | 'link' | 'iframe' | 'custom'
	templateId: string
	style: {
		width: number
		height: number
		order: number
		offsetX: number | null
		offsetY: number | null
		enabled: boolean
	}
	content: {
		text?: string
		imageUrl?: string
		linkUrl?: string
		iframeUrl?: string
		html?: string
	}
}

interface CustomComponentStore {
	components: CustomComponent[]
	addComponent: (component: Omit<CustomComponent, 'id'>) => void
	updateComponent: (id: string, updates: Partial<CustomComponent>) => void
	deleteComponent: (id: string) => void
	getComponent: (id: string) => CustomComponent | undefined
}

// 初始化：优先用 localStorage（本地编辑缓存），否则用项目 JSON 文件（部署数据源）
// 注意：如果 localStorage 存的是空数组，说明用户执行过"重置全部"但未持久化，应回退到项目文件
const getInitialComponents = (): CustomComponent[] => {
	if (typeof window === 'undefined') return customComponentsDefault as CustomComponent[]
	try {
		const saved = localStorage.getItem('custom-components')
		if (saved) {
			const parsed = JSON.parse(saved)
			if (Array.isArray(parsed) && parsed.length > 0) return parsed
		}
	} catch {}
	return customComponentsDefault as CustomComponent[]
}

export const useCustomComponentStore = create<CustomComponentStore>((set, get) => ({
	components: getInitialComponents(),

	addComponent: (component) => {
		const newComponent: CustomComponent = {
			...component,
			id: `custom-${Date.now()}`
		}
		set(state => {
			const newComponents = [...state.components, newComponent]
			if (typeof window !== 'undefined') {
				localStorage.setItem('custom-components', JSON.stringify(newComponents))
			}
			return { components: newComponents }
		})
	},

	updateComponent: (id, updates) => {
		set(state => {
			const newComponents = state.components.map(c =>
				c.id === id ? { ...c, ...updates } : c
			)
			if (typeof window !== 'undefined') {
				localStorage.setItem('custom-components', JSON.stringify(newComponents))
			}
			return { components: newComponents }
		})
	},

	deleteComponent: (id) => {
		set(state => {
			const newComponents = state.components.filter(c => c.id !== id)
			if (typeof window !== 'undefined') {
				localStorage.setItem('custom-components', JSON.stringify(newComponents))
			}
			return { components: newComponents }
		})
	},

	getComponent: (id) => {
		return get().components.find(c => c.id === id)
	}
}))
