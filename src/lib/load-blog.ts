import type { BlogConfig } from '@/app/blog/types'
import { parseBlogStorageDB } from '@/lib/content-db/blog-storage'

export type { BlogConfig } from '@/app/blog/types'

const LOAD_BLOG_FETCH_OPTIONS: RequestInit = { cache: 'no-store' }
const LOAD_BLOG_TEXT_LIMITS = {
	storage: 2 * 1024 * 1024,
	config: 64 * 1024,
	markdown: 2 * 1024 * 1024,
	errorDetail: 8 * 1024
} as const

export type LoadedBlog = {
	slug: string
	config: BlogConfig
	markdown: string
	cover?: string
}

function isPlainBlogConfig(value: unknown): value is BlogConfig {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function assertBlogStorageJsonSyntax(raw: string): void {
	try {
		JSON.parse(raw)
	} catch {
		throw new Error('博客存储格式错误')
	}
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

async function readLimitedLoadBlogText(response: Response, actionName: string, limitBytes: number): Promise<string> {
	const contentLength = response.headers.get('content-length')
	if (contentLength && Number(contentLength) > limitBytes) {
		throw new Error(`${actionName}失败：文件过大`)
	}

	if (!response.body) {
		const text = await response.text()
		if (new TextEncoder().encode(text).byteLength > limitBytes) {
			throw new Error(`${actionName}失败：文件过大`)
		}
		return text
	}

	const reader = response.body.getReader()
	const chunks: Uint8Array[] = []
	let total = 0

	try {
		while (true) {
			const { done, value } = await reader.read()
			if (done) break
			total += value.byteLength
			if (total > limitBytes) {
				await reader.cancel()
				throw new Error(`${actionName}失败：文件过大`)
			}
			chunks.push(value)
		}
	} finally {
		reader.releaseLock()
	}

	const buffer = new Uint8Array(total)
	let offset = 0
	for (const chunk of chunks) {
		buffer.set(chunk, offset)
		offset += chunk.byteLength
	}
	return new TextDecoder().decode(buffer)
}

async function readErrorDetail(response: Response): Promise<string> {
	try {
		return await readLimitedLoadBlogText(response, '读取错误详情', LOAD_BLOG_TEXT_LIMITS.errorDetail)
	} catch {
		return ''
	}
}

async function assertLoadBlogOk(response: Response, actionName: string) {
	if (response.ok) {
		return
	}

	const detail = await readErrorDetail(response)
	throw new Error(detail ? `${actionName}失败：${detail}` : `${actionName}失败`)
}

async function readOptionalLoadBlogText(response: Response, actionName: string, limitBytes: number): Promise<string | null> {
	if (response.status === 404) {
		return null
	}
	await assertLoadBlogOk(response, actionName)
	return readLimitedLoadBlogText(response, actionName, limitBytes)
}

async function readRequiredLoadBlogText(response: Response, actionName: string, limitBytes: number): Promise<string> {
	if (response.status === 404) {
		throw new Error('Blog not found')
	}
	await assertLoadBlogOk(response, actionName)
	return readLimitedLoadBlogText(response, actionName, limitBytes)
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
	const storageRaw = await readOptionalLoadBlogText(storageRes, '读取博客存储', LOAD_BLOG_TEXT_LIMITS.storage)
	if (storageRaw !== null) {
		assertBlogStorageJsonSyntax(storageRaw)
		const storage = parseBlogStorageDB(storageRaw)
		config = toBlogConfigFromStorageRecord(storage.blogs[slug] as Record<string, unknown> | undefined)
	}

	if (Object.keys(config).length === 0) {
		const configRes = await fetch(`/blogs/${encodeURIComponent(slug)}/config.json`, LOAD_BLOG_FETCH_OPTIONS)
		const configRaw = await readOptionalLoadBlogText(configRes, '读取博客配置', LOAD_BLOG_TEXT_LIMITS.config)
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
	const markdown = await readRequiredLoadBlogText(mdRes, '读取博客 Markdown', LOAD_BLOG_TEXT_LIMITS.markdown)

	return {
		slug,
		config,
		markdown,
		cover: config.cover
	}
}
