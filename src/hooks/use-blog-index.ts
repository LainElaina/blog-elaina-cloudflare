import useSWR from 'swr'
import { useAuthStore } from '@/hooks/use-auth'
import type { BlogIndexItem } from '@/app/blog/types'

export type { BlogIndexItem } from '@/app/blog/types'

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
	return data
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

export function useLatestBlog() {
	const { items, loading, error } = useBlogIndex()

	const latestBlog = items.length > 0 ? items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] : null

	return {
		blog: latestBlog,
		loading,
		error
	}
}
