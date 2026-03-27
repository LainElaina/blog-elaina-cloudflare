export type BlogFolderNode = {
	name: string
	path: string
	children: BlogFolderNode[]
}

function normalizeFolderPath(input: string): string | null {
	const trimmed = input.trim()
	if (!trimmed) return null
	const parts = trimmed.split('/').filter(Boolean)
	if (parts.length === 0) return null
	return `/${parts.join('/')}`
}

export function dedupeAndSortFolderPaths(folderPaths: Array<string | undefined | null>): string[] {
	const normalized = folderPaths
		.filter((v): v is string => typeof v === 'string')
		.map(normalizeFolderPath)
		.filter((v): v is string => Boolean(v))
	return Array.from(new Set(normalized)).sort((a, b) => a.localeCompare(b))
}

export function buildBlogFolderTree(folderPaths: Array<string | undefined | null>): BlogFolderNode[] {
	const sortedPaths = dedupeAndSortFolderPaths(folderPaths)
	const root: BlogFolderNode[] = []
	const nodeMap = new Map<string, BlogFolderNode>()

	for (const path of sortedPaths) {
		const parts = path.split('/').filter(Boolean)
		let currentPath = ''
		let siblings = root
		for (const part of parts) {
			currentPath += `/${part}`
			let node = nodeMap.get(currentPath)
			if (!node) {
				node = { name: part, path: currentPath, children: [] }
				nodeMap.set(currentPath, node)
				siblings.push(node)
			}
			siblings = node.children
		}
	}

	return root
}
