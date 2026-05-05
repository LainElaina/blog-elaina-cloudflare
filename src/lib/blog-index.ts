'use client'

import type { BlogIndexItem } from '@/app/blog/types'
import {
	buildBlogStorageFromIndex,
	exportStaticBlogArtifacts,
	parseRequiredBlogStorageDB,
	removeBlogRecord,
	upsertBlogRecord,
	type BlogStorageDB,
	type StaticBlogArtifacts
} from '@/lib/content-db/blog-storage'
import { putFile, readTextFileFromRepo, toBase64Utf8 } from '@/lib/github-client'

export type { BlogIndexItem } from '@/app/blog/types'
export type { BlogStorageDB, StaticBlogArtifacts } from '@/lib/content-db/blog-storage'

const BLOG_INDEX_PATH = 'public/blogs/index.json'
const BLOG_CATEGORIES_PATH = 'public/blogs/categories.json'
const BLOG_STORAGE_PATH = 'public/blogs/storage.json'
const BLOG_FOLDERS_PATH = 'public/blogs/folders.json'

export function serializeCategoriesConfig(categories: string[]): string {
	return JSON.stringify({ categories }, null, 2)
}

function isBlogIndexItem(value: unknown): value is BlogIndexItem {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return false
	}
	const item = value as Partial<BlogIndexItem>
	return (
		typeof item.slug === 'string' &&
		item.slug.trim().length > 0 &&
		typeof item.title === 'string' &&
		Array.isArray(item.tags) &&
		item.tags.every(tag => typeof tag === 'string') &&
		typeof item.date === 'string' &&
		(item.summary === undefined || typeof item.summary === 'string') &&
		(item.cover === undefined || typeof item.cover === 'string') &&
		(item.hidden === undefined || typeof item.hidden === 'boolean') &&
		(item.category === undefined || typeof item.category === 'string') &&
		(item.folderPath === undefined || typeof item.folderPath === 'string') &&
		(item.favorite === undefined || typeof item.favorite === 'boolean')
	)
}

function parseBlogIndexItemsRaw(raw: string): BlogIndexItem[] {
	let parsed: unknown
	try {
		parsed = JSON.parse(raw)
	} catch {
		throw new Error('博客 index.json 解析失败，请修复 public/blogs/index.json 后重试')
	}

	if (!Array.isArray(parsed) || !parsed.every(isBlogIndexItem)) {
		throw new Error('博客 index.json 格式错误，请修复 public/blogs/index.json 后重试')
	}

	return parsed
}

async function readIndexItemsFromRepo(token: string, owner: string, repo: string, branch: string): Promise<BlogIndexItem[]> {
	const txt = await readTextFileFromRepo(token, owner, repo, BLOG_INDEX_PATH, branch)
	if (txt === null) return []

	return parseBlogIndexItemsRaw(txt)
}

export async function prepareBlogStaticArtifacts(params: {
	readStorageRaw: () => Promise<string | null>
	fallbackReadIndexRaw?: () => Promise<string | null>
	upsertItem?: BlogIndexItem
	removeSlugs?: string[]
	now?: Date
}): Promise<StaticBlogArtifacts> {
	const now = params.now ?? new Date()
	const storageRaw = await params.readStorageRaw()
	let db = parseRequiredBlogStorageDB(storageRaw)

	if (!storageRaw && params.fallbackReadIndexRaw) {
		const fallbackRaw = await params.fallbackReadIndexRaw()
		if (fallbackRaw) {
			db = buildBlogStorageFromIndex(parseBlogIndexItemsRaw(fallbackRaw), now)
		}
	}

	if (params.upsertItem) {
		db = upsertBlogRecord(db, params.upsertItem, { now })
	}

	if (params.removeSlugs?.length) {
		for (const slug of params.removeSlugs.filter(Boolean)) {
			db = removeBlogRecord(db, slug, now)
		}
	}

	return exportStaticBlogArtifacts(db)
}

export async function upsertBlogsIndex(token: string, owner: string, repo: string, item: BlogIndexItem, branch: string): Promise<void> {
	const artifacts = await prepareBlogStaticArtifacts({
		readStorageRaw: () => readTextFileFromRepo(token, owner, repo, BLOG_STORAGE_PATH, branch),
		fallbackReadIndexRaw: () => readTextFileFromRepo(token, owner, repo, BLOG_INDEX_PATH, branch),
		upsertItem: item
	})
	await putFile(token, owner, repo, BLOG_INDEX_PATH, toBase64Utf8(JSON.stringify(artifacts.index, null, 2)), 'Update blogs index', branch)
	await putFile(token, owner, repo, BLOG_CATEGORIES_PATH, toBase64Utf8(serializeCategoriesConfig(artifacts.categories)), 'Update blogs categories', branch)
	await putFile(token, owner, repo, BLOG_FOLDERS_PATH, toBase64Utf8(JSON.stringify(artifacts.folders, null, 2)), 'Update blogs folders', branch)
	await putFile(token, owner, repo, BLOG_STORAGE_PATH, toBase64Utf8(JSON.stringify(artifacts.db, null, 2)), 'Update blogs storage', branch)
}

export async function prepareBlogsIndex(token: string, owner: string, repo: string, item: BlogIndexItem, branch: string): Promise<string> {
	const artifacts = await prepareBlogStaticArtifacts({
		readStorageRaw: () => readTextFileFromRepo(token, owner, repo, BLOG_STORAGE_PATH, branch),
		fallbackReadIndexRaw: () => readTextFileFromRepo(token, owner, repo, BLOG_INDEX_PATH, branch),
		upsertItem: item
	})
	return JSON.stringify(artifacts.index, null, 2)
}

export async function removeBlogsFromIndex(token: string, owner: string, repo: string, slugs: string[], branch: string): Promise<string> {
	const artifacts = await prepareBlogStaticArtifacts({
		readStorageRaw: () => readTextFileFromRepo(token, owner, repo, BLOG_STORAGE_PATH, branch),
		fallbackReadIndexRaw: () => readTextFileFromRepo(token, owner, repo, BLOG_INDEX_PATH, branch),
		removeSlugs: slugs
	})
	return JSON.stringify(artifacts.index, null, 2)
}

export async function removeBlogFromIndex(token: string, owner: string, repo: string, slug: string, branch: string): Promise<string> {
	return removeBlogsFromIndex(token, owner, repo, [slug], branch)
}

export async function prepareBlogStorageArtifacts(token: string, owner: string, repo: string, branch: string): Promise<StaticBlogArtifacts> {
	const storageRaw = await readTextFileFromRepo(token, owner, repo, BLOG_STORAGE_PATH, branch)
	if (storageRaw) {
		return exportStaticBlogArtifacts(parseRequiredBlogStorageDB(storageRaw))
	}
	const index = await readIndexItemsFromRepo(token, owner, repo, branch)
	const db: BlogStorageDB = buildBlogStorageFromIndex(index)
	return exportStaticBlogArtifacts(db)
}
