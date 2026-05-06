import useSWR from 'swr'
import { useAuthStore } from '@/hooks/use-auth'
import type { BlogIndexItem } from '@/app/blog/types'

export type { BlogIndexItem } from '@/app/blog/types'

function isObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function optionalString(value: unknown) {
	return typeof value === 'string' ? value : undefined
}

function optionalBoolean(value: unknown) {
	return typeof value === 'boolean' ? value : undefined
}

function normalizeHidden(value: unknown) {
	if (value === undefined) return undefined
	if (typeof value === 'boolean') return value
	if (value === 'true') return true
	if (value === 'false') return false
	return true
}

function normalizeBlogIndexItem(value: unknown): BlogIndexItem | null {
	if (!isObject(value) || typeof value.slug !== 'string' || typeof value.title !== 'string' || typeof value.date !== 'string') {
		return null
	}

	return {
		slug: value.slug,
		title: value.title,
		date: value.date,
		tags: Array.isArray(value.tags) ? value.tags.filter((tag): tag is string => typeof tag === 'string') : [],
		summary: optionalString(value.summary),
		cover: optionalString(value.cover),
		hidden: normalizeHidden(value.hidden),
		category: optionalString(value.category),
		folderPath: optionalString(value.folderPath),
		favorite: optionalBoolean(value.favorite)
	}
}

export function normalizeBlogIndexItems(value: unknown): BlogIndexItem[] {
	return Array.isArray(value)
		? value.map(normalizeBlogIndexItem).filter((item): item is BlogIndexItem => Boolean(item))
		: []
}

export const fetchBlogIndex = async (url: string): Promise<BlogIndexItem[]> => {
	const res = await fetch(url, { cache: 'no-store' })
	if (!res.ok) {
		const error: any = new Error('Fetch failed')
		error.status = res.status
		throw error
	}
	const data = await res.json()
	if (!Array.isArray(data)) {
		throw new Error('博客索引格式错误')
	}
	return normalizeBlogIndexItems(data)
}

export function useBlogIndex() {
	const { isAuth } = useAuthStore()
	const { data, error, isLoading, mutate } = useSWR<BlogIndexItem[]>('/blogs/index.json', fetchBlogIndex, {
		revalidateOnFocus: false,
		revalidateOnReconnect: true
	})

	let result = data || []
	if (!isAuth) {
		result = result.filter(item => !item.hidden)
	}

	return {
		items: result,
		loading: isLoading,
		error,
		mutate
	}
}

export function getLatestBlogItem(items: BlogIndexItem[]) {
	return items.length > 0 ? [...items].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] : null
}

export function useLatestBlog() {
	const { items, loading, error } = useBlogIndex()
	const latestBlog = getLatestBlogItem(items)

	return {
		blog: latestBlog,
		loading,
		error
	}
}
