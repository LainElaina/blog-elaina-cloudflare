import { create } from 'zustand'
import { COMPONENT_REGISTRY } from '@/config/component-registry'
import { CardStyles } from './config-store'

export interface Template {
	id: string
	name: string
	components: string[]
	styles: CardStyles
}

interface TemplateStore {
	templates: Template[]
	activeComponents: string[]
	addTemplate: (name: string, components: string[], styles: CardStyles) => void
	deleteTemplate: (id: string) => void
	loadTemplate: (id: string) => CardStyles | null
	setActiveComponents: (components: string[]) => void
	addComponent: (componentId: string) => void
	removeComponent: (componentId: string) => void
	getCurrentTemplate: () => Template
}

const getInitialActiveComponents = (): string[] => {
	if (typeof window === 'undefined') return []
	const saved = localStorage.getItem('active-components')
	return saved ? JSON.parse(saved) : Object.keys(COMPONENT_REGISTRY)
}

export const useTemplateStore = create<TemplateStore>((set, get) => ({
	templates: [],
	activeComponents: Object.keys(COMPONENT_REGISTRY),

	addTemplate: (name, components, styles) => {
		const template: Template = {
			id: `${Date.now()}`,
			name,
			components,
			styles
		}
		set(state => {
			const newTemplates = [...state.templates, template]
			localStorage.setItem('templates', JSON.stringify(newTemplates))
			return { templates: newTemplates }
		})
	},

	deleteTemplate: (id) => {
		set(state => {
			const newTemplates = state.templates.filter(t => t.id !== id)
			localStorage.setItem('templates', JSON.stringify(newTemplates))
			return { templates: newTemplates }
		})
	},

	loadTemplate: (id) => {
		const template = get().templates.find(t => t.id === id)
		if (!template) return null
		set({ activeComponents: template.components })
		localStorage.setItem('active-components', JSON.stringify(template.components))
		return template.styles
	},

	setActiveComponents: (components) => {
		set({ activeComponents: components })
		localStorage.setItem('active-components', JSON.stringify(components))
	},

	addComponent: (componentId) => {
		if (!COMPONENT_REGISTRY[componentId]) return
		set(state => {
			const newComponents = [...state.activeComponents, componentId]
			localStorage.setItem('active-components', JSON.stringify(newComponents))
			return { activeComponents: newComponents }
		})
	},

	removeComponent: (componentId) => {
		set(state => {
			const newComponents = state.activeComponents.filter(id => id !== componentId)
			localStorage.setItem('active-components', JSON.stringify(newComponents))
			return { activeComponents: newComponents }
		})
	},

	getCurrentTemplate: () => {
		const { activeComponents } = get()
		const styles = {} as CardStyles
		activeComponents.forEach(id => {
			const meta = COMPONENT_REGISTRY[id]
			if (meta) {
				styles[id as keyof CardStyles] = meta.defaultStyle as any
			}
		})
		return {
			id: 'current',
			name: '当前配置',
			components: activeComponents,
			styles
		}
	}
}))
