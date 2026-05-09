import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Use object hash for faster lookup - O(1) time complexity
type ReadArticlesHash = Record<string, boolean>

function isObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function normalizeReadArticles(value: unknown): ReadArticlesHash {
	if (!isObject(value)) return {}

	return Object.fromEntries(Object.entries(value).filter(([slug, isRead]) => slug.trim() && isRead === true)) as ReadArticlesHash
}

interface ReadArticlesStore {
	readArticles: ReadArticlesHash
	markAsRead: (slug: string) => void
	isRead: (slug: string) => boolean
	clearAll: () => void
}

export const useReadArticles = create<ReadArticlesStore>()(
	persist(
		(set, get) => ({
			readArticles: {},
			markAsRead: (slug: string) => {
				set(state => ({
					readArticles: {
						...state.readArticles,
						[slug]: true
					}
				}))
			},
			isRead: (slug: string) => {
				return get().readArticles[slug] === true
			},
			clearAll: () => {
				set({ readArticles: {} })
			}
		}),
		{
			name: 'blog-read-articles',
			merge: (persistedState, currentState) => {
				const readArticles = isObject(persistedState) ? normalizeReadArticles(persistedState.readArticles) : {}
				return { ...currentState, readArticles }
			}
		}
	)
)
