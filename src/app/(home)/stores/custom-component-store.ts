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

const CUSTOM_COMPONENT_TYPES = new Set(['text', 'image', 'link', 'iframe', 'custom'])

function isObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value)
}

function isCustomComponent(value: unknown): value is CustomComponent {
	if (!isObject(value) || !isObject(value.style) || !isObject(value.content)) return false

	return typeof value.id === 'string' &&
		typeof value.name === 'string' &&
		typeof value.templateId === 'string' &&
		typeof value.type === 'string' &&
		CUSTOM_COMPONENT_TYPES.has(value.type) &&
		isFiniteNumber(value.style.width) &&
		isFiniteNumber(value.style.height) &&
		isFiniteNumber(value.style.order) &&
		(isFiniteNumber(value.style.offsetX) || value.style.offsetX === null) &&
		(isFiniteNumber(value.style.offsetY) || value.style.offsetY === null) &&
		typeof value.style.enabled === 'boolean'
}

export function normalizeCustomComponents(value: unknown): CustomComponent[] {
	return Array.isArray(value) ? value.filter(isCustomComponent) : []
}

// 初始化：优先用 localStorage（本地编辑缓存），否则用项目 JSON 文件（部署数据源）
const getInitialComponents = (): CustomComponent[] => {
	if (typeof window === 'undefined') return normalizeCustomComponents(customComponentsDefault)
	try {
		const saved = localStorage.getItem('custom-components')
		if (saved) {
			const parsed = JSON.parse(saved)
			if (Array.isArray(parsed)) return normalizeCustomComponents(parsed)
		}
	} catch {}
	return normalizeCustomComponents(customComponentsDefault)
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
