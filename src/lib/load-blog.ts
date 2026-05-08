import type { BlogConfig } from '@/app/blog/types'
import { parseRequiredBlogStorageDB } from '@/lib/content-db/blog-storage'

export type { BlogConfig } from '@/app/blog/types'

const LOAD_BLOG_FETCH_OPTIONS: RequestInit = { cache: 'no-store' }

export type LoadedBlog = {
	slug: string
	config: BlogConfig
	markdown: string
	cover?: string
}

function isPlainBlogConfig(value: unknown): value is BlogConfig {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function toBlogConfigFromStorageRecord(record: Record<string, unknown> | undefined): BlogConfig {
	const config: BlogConfig = {}
	if (!record) return config
	if (typeof record.title === 'string') config.title = record.title
	if (Array.isArray(record.tags) && record.tags.every((tag): tag is string => typeof tag === 'string')) config.tags = record.tags
	if (typeof record.date === 'string') config.date = record.date
	if (typeof record.summary === 'string') config.summary = record.summary
	if (typeof record.cover === 'string') config.cover = record.cover
	if (typeof record.hidden === 'boolean') config.hidden = record.hidden
	if (typeof record.category === 'string') config.category = record.category
	if (typeof record.folderPath === 'string') config.folderPath = record.folderPath
	if (typeof record.favorite === 'boolean') config.favorite = record.favorite
	return config
}

async function assertLoadBlogOk(response: Response, actionName: string) {
	if (response.ok) {
		return
	}

	const detail = await response.text().catch(() => '')
	throw new Error(detail ? `${actionName}失败：${detail}` : `${actionName}失败`)
}

async function readOptionalLoadBlogText(response: Response, actionName: string): Promise<string | null> {
	if (response.status === 404) {
		return null
	}
	await assertLoadBlogOk(response, actionName)
	return response.text()
}

async function readRequiredLoadBlogText(response: Response, actionName: string): Promise<string> {
	if (response.status === 404) {
		throw new Error('Blog not found')
	}
	await assertLoadBlogOk(response, actionName)
	return response.text()
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
	const storageRes = await fetch('/blogs/storage.json', LOAD_BLOG_FETCH_OPTIONS)
	const storageRaw = await readOptionalLoadBlogText(storageRes, '读取博客存储')
	if (storageRaw !== null) {
		try {
			const storage = parseRequiredBlogStorageDB(storageRaw)
			config = toBlogConfigFromStorageRecord(storage.blogs[slug] as Record<string, unknown> | undefined)
		} catch {
			throw new Error('博客存储格式错误')
		}
	}

	if (Object.keys(config).length === 0) {
		const configRes = await fetch(`/blogs/${encodeURIComponent(slug)}/config.json`, LOAD_BLOG_FETCH_OPTIONS)
		const configRaw = await readOptionalLoadBlogText(configRes, '读取博客配置')
		if (configRaw !== null) {
			try {
				const parsedConfig = JSON.parse(configRaw)
				if (!isPlainBlogConfig(parsedConfig)) {
					throw new Error('博客配置格式错误')
				}
				config = toBlogConfigFromStorageRecord(parsedConfig)
			} catch {
				throw new Error('博客配置格式错误')
			}
		}
	}

	const mdRes = await fetch(`/blogs/${encodeURIComponent(slug)}/index.md`, LOAD_BLOG_FETCH_OPTIONS)
	const markdown = await readRequiredLoadBlogText(mdRes, '读取博客 Markdown')

	return {
		slug,
		config,
		markdown,
		cover: config.cover
	}
}
