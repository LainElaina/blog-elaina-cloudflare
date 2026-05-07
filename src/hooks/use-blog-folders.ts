'use client'

import useSWR from 'swr'

type BlogFolderNodeLike = {
	path: string
	children?: unknown
}

export type BlogFoldersConfig = {
	folders: string[]
}

function isFolderNode(value: unknown): value is BlogFolderNodeLike {
	if (!value || typeof value !== 'object') return false
	const node = value as BlogFolderNodeLike
	return typeof node.path === 'string'
}

function normalizeFolderPathList(input: unknown): string[] {
	if (!Array.isArray(input)) return []

	const result: string[] = []
	const visited = new Set<string>()
	for (const item of input) {
		if (typeof item !== 'string') continue
		const path = item.trim()
		if (!path || visited.has(path)) continue
		visited.add(path)
		result.push(path)
	}
	return result
}

function flattenFolderTree(input: unknown): string[] {
	if (!Array.isArray(input)) return []

	const result: string[] = []
	const visited = new Set<string>()
	const stack = [...input]

	while (stack.length > 0) {
		const current = stack.shift()
		if (!isFolderNode(current)) continue

		const path = current.path.trim()
		if (path && !visited.has(path)) {
			visited.add(path)
			result.push(path)
		}

		if (Array.isArray(current.children)) {
			stack.unshift(...current.children)
		}
	}

	return result
}

export function parseBlogFoldersConfig(data: unknown): BlogFoldersConfig {
	if (Array.isArray(data)) {
		const stringFolders = normalizeFolderPathList(data)
		if (stringFolders.length > 0) {
			return { folders: stringFolders }
		}
		return { folders: flattenFolderTree(data) }
	}

	if (Array.isArray((data as any)?.folders)) {
		const folders = (data as any).folders
		const stringFolders = normalizeFolderPathList(folders)
		if (stringFolders.length > 0) {
			return { folders: stringFolders }
		}
		return { folders: flattenFolderTree(folders) }
	}

	return { folders: [] }
}

export const fetchBlogFoldersConfig = async (url: string): Promise<BlogFoldersConfig> => {
	const res = await fetch(url, { cache: 'no-store' })
	if (!res.ok) {
		if (res.status === 404) {
			return { folders: [] }
		}

		const error: any = new Error('Fetch failed')
		error.status = res.status
		throw error
	}

	let data: unknown
	try {
		data = await res.json()
	} catch {
		return { folders: [] }
	}
	return parseBlogFoldersConfig(data)
}

export function useBlogFolders() {
	const { data, error, isLoading, mutate } = useSWR<BlogFoldersConfig>('/blogs/folders.json', fetchBlogFoldersConfig, {
		revalidateOnFocus: false,
		revalidateOnReconnect: true
	})

	return {
		folders: data?.folders ?? [],
		loading: isLoading,
		error,
		mutate
	}
}
