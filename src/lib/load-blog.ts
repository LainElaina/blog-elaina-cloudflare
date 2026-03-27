import type { BlogConfig } from '@/app/blog/types'
import { parseBlogStorageDB } from '@/lib/content-db/blog-storage'

export type { BlogConfig } from '@/app/blog/types'

export type LoadedBlog = {
	slug: string
	config: BlogConfig
	markdown: string
	cover?: string
}

function toBlogConfigFromStorageRecord(record: Record<string, unknown> | undefined): BlogConfig {
	if (!record) return {}
	return {
		title: typeof record.title === 'string' ? record.title : undefined,
		tags: Array.isArray(record.tags) ? (record.tags as string[]) : undefined,
		date: typeof record.date === 'string' ? record.date : undefined,
		summary: typeof record.summary === 'string' ? record.summary : undefined,
		cover: typeof record.cover === 'string' ? record.cover : undefined,
		hidden: typeof record.hidden === 'boolean' ? record.hidden : undefined,
		category: typeof record.category === 'string' ? record.category : undefined,
		folderPath: typeof record.folderPath === 'string' ? record.folderPath : undefined,
		favorite: typeof record.favorite === 'boolean' ? record.favorite : undefined
	}
}

/**
 * Load blog data from public/blogs/{slug}
 * Used by both view page and edit page
 */
export async function loadBlog(slug: string): Promise<LoadedBlog> {
	if (!slug) {
		throw new Error('Slug is required')
	}

	let config: BlogConfig = {}
	const storageRes = await fetch('/blogs/storage.json')
	if (storageRes.ok) {
		try {
			const storageRaw = await storageRes.text()
			const storage = parseBlogStorageDB(storageRaw)
			config = toBlogConfigFromStorageRecord(storage.blogs[slug] as Record<string, unknown> | undefined)
		} catch {
			config = {}
		}
	}

	if (Object.keys(config).length === 0) {
		const configRes = await fetch(`/blogs/${encodeURIComponent(slug)}/config.json`)
		if (configRes.ok) {
			try {
				config = await configRes.json()
			} catch {
				config = {}
			}
		}
	}

	const mdRes = await fetch(`/blogs/${encodeURIComponent(slug)}/index.md`)
	if (!mdRes.ok) {
		throw new Error('Blog not found')
	}
	const markdown = await mdRes.text()

	return {
		slug,
		config,
		markdown,
		cover: config.cover
	}
}
