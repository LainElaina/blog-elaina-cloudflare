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

export const useCustomComponentStore = create<CustomComponentStore>((set, get) => ({
	components: [],

	addComponent: (component) => {
		const newComponent: CustomComponent = {
			...component,
			id: `custom-${Date.now()}`
		}
		console.log('添加自定义组件:', newComponent)
		set(state => {
			const newComponents = [...state.components, newComponent]
			if (typeof window !== 'undefined') {
				localStorage.setItem('custom-components', JSON.stringify(newComponents))
				console.log('保存到 localStorage:', newComponents)
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
