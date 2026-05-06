'use client'

import useSWR from 'swr'

export type CategoriesConfig = {
	categories: string[]
}

function normalizeStringList(value: unknown): string[] {
	if (!Array.isArray(value)) return []

	const result: string[] = []
	const visited = new Set<string>()
	for (const item of value) {
		if (typeof item !== 'string') continue
		const normalized = item.trim()
		if (!normalized || visited.has(normalized)) continue
		visited.add(normalized)
		result.push(normalized)
	}
	return result
}

export const fetchCategoriesConfig = async (url: string): Promise<CategoriesConfig> => {
	const res = await fetch(url, { cache: 'no-store' })
	if (!res.ok) {
		if (res.status === 404) {
			return { categories: [] }
		}

		const error: any = new Error('Fetch failed')
		error.status = res.status
		throw error
	}
	const data = await res.json()
	if (Array.isArray(data)) {
		return { categories: normalizeStringList(data) }
	}
	if (Array.isArray((data as any)?.categories)) {
		return { categories: normalizeStringList((data as any).categories) }
	}
	return { categories: [] }
}

export function useCategories() {
	const { data, error, isLoading, mutate } = useSWR<CategoriesConfig>('/blogs/categories.json', fetchCategoriesConfig, {
		revalidateOnFocus: false,
		revalidateOnReconnect: true
	})

	return {
		categories: data?.categories ?? [],
		loading: isLoading,
		error,
		mutate
	}
}

