import { create } from 'zustand'
import { type CustomComponent, isCustomComponentData } from './custom-component-store'

export interface ComponentFavorite {
	id: string
	name: string
	component: Omit<CustomComponent, 'id'>
	preview?: string
}

interface ComponentFavoriteStore {
	favorites: ComponentFavorite[]
	addFavorite: (name: string, component: Omit<CustomComponent, 'id'>) => void
	deleteFavorite: (id: string) => void
	getFavorite: (id: string) => ComponentFavorite | undefined
}

function isObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isComponentFavorite(value: unknown): value is ComponentFavorite {
	return isObject(value) &&
		typeof value.id === 'string' &&
		typeof value.name === 'string' &&
		isCustomComponentData(value.component) &&
		(value.preview === undefined || typeof value.preview === 'string')
}

function isComponentFavoriteImport(value: unknown): value is Pick<ComponentFavorite, 'name' | 'component'> {
	return isObject(value) &&
		typeof value.name === 'string' &&
		isCustomComponentData(value.component)
}

export function normalizeComponentFavorites(value: unknown): ComponentFavorite[] {
	return Array.isArray(value) ? value.filter(isComponentFavorite) : []
}

export function normalizeComponentFavoriteImports(value: unknown): Pick<ComponentFavorite, 'name' | 'component'>[] {
	return Array.isArray(value) ? value.filter(isComponentFavoriteImport) : []
}

export const useComponentFavoriteStore = create<ComponentFavoriteStore>((set, get) => ({
	favorites: [],

	addFavorite: (name, component) => {
		const favorite: ComponentFavorite = {
			id: `fav-${Date.now()}`,
			name,
			component
		}
		set(state => {
			const newFavorites = [...state.favorites, favorite]
			if (typeof window !== 'undefined') {
				localStorage.setItem('component-favorites', JSON.stringify(newFavorites))
			}
			return { favorites: newFavorites }
		})
	},

	deleteFavorite: (id) => {
		set(state => {
			const newFavorites = state.favorites.filter(f => f.id !== id)
			if (typeof window !== 'undefined') {
				localStorage.setItem('component-favorites', JSON.stringify(newFavorites))
			}
			return { favorites: newFavorites }
		})
	},

	getFavorite: (id) => {
		return get().favorites.find(f => f.id === id)
	}
}))
