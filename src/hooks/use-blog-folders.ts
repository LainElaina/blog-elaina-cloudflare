'use client'

import useSWR from 'swr'

export type BlogFoldersConfig = {
	folders: string[]
}

const fetcher = async (url: string): Promise<BlogFoldersConfig> => {
	const res = await fetch(url, { cache: 'no-store' })
	if (!res.ok) {
		return { folders: [] }
	}

	const data = await res.json()
	if (Array.isArray(data)) {
		return { folders: data.filter((item): item is string => typeof item === 'string') }
	}
	if (Array.isArray((data as any)?.folders)) {
		return { folders: (data as any).folders.filter((item: unknown): item is string => typeof item === 'string') }
	}
	return { folders: [] }
}

export function useBlogFolders() {
	const { data, error, isLoading } = useSWR<BlogFoldersConfig>('/blogs/folders.json', fetcher, {
		revalidateOnFocus: false,
		revalidateOnReconnect: true
	})

	return {
		folders: data?.folders ?? [],
		loading: isLoading,
		error
	}
}
