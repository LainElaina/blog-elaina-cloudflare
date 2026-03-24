import { create } from 'zustand'
import { CustomComponent } from './custom-component-store'

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
