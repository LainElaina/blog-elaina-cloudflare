import { create } from 'zustand'
import { CardStyles } from './config-store'

export interface Template {
	id: string
	name: string
	styles: CardStyles
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
