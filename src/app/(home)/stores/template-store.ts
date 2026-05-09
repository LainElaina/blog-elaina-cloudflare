import { create } from 'zustand'
import type { CardStyles } from './config-store'

export interface Template {
	id: string
	name: string
	styles: CardStyles
}

function isObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function normalizeTemplates(value: unknown): Template[] {
	if (!Array.isArray(value)) return []

	return value
		.filter(template => isObject(template) && typeof template.id === 'string' && typeof template.name === 'string' && isObject(template.styles))
		.map(template => ({ id: template.id, name: template.name, styles: template.styles as CardStyles }))
}

interface TemplateStore {
	templates: Template[]
	addTemplate: (name: string, styles: CardStyles) => void
	deleteTemplate: (id: string) => void
	loadTemplate: (id: string) => CardStyles | null
}

export const useTemplateStore = create<TemplateStore>((set, get) => ({
	templates: [],

	addTemplate: (name, styles) => {
		const template: Template = {
			id: `${Date.now()}`,
			name,
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
		return template ? template.styles : null
	}
}))
