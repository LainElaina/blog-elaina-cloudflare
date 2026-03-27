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
		const stringFolders = data.filter((item): item is string => typeof item === 'string')
		if (stringFolders.length > 0) {
			return { folders: stringFolders }
		}
		return { folders: flattenFolderTree(data) }
	}

	if (Array.isArray((data as any)?.folders)) {
		const folders = (data as any).folders
		const stringFolders = folders.filter((item: unknown): item is string => typeof item === 'string')
		if (stringFolders.length > 0) {
			return { folders: stringFolders }
		}
		return { folders: flattenFolderTree(folders) }
	}

	return { folders: [] }
}

const fetcher = async (url: string): Promise<BlogFoldersConfig> => {
	const res = await fetch(url, { cache: 'no-store' })
	if (!res.ok) {
		return { folders: [] }
	}

	const data = await res.json()
	return parseBlogFoldersConfig(data)
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
