'use client'

import type { BlogIndexItem } from '@/app/blog/types'
import {
	buildBlogStorageFromIndex,
	createEmptyBlogStorageDB,
	exportStaticBlogArtifacts,
	parseBlogStorageDB,
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

async function readIndexItemsFromRepo(token: string, owner: string, repo: string, branch: string): Promise<BlogIndexItem[]> {
	try {
		const txt = await readTextFileFromRepo(token, owner, repo, BLOG_INDEX_PATH, branch)
		if (!txt) return []
		const parsed = JSON.parse(txt)
		if (!Array.isArray(parsed)) return []
		return parsed as BlogIndexItem[]
	} catch {
		return []
	}
}

export async function prepareBlogStaticArtifacts(params: {
	readStorageRaw: () => Promise<string | null>
	fallbackReadIndexRaw?: () => Promise<string | null>
	upsertItem?: BlogIndexItem
	removeSlugs?: string[]
	now?: Date
}): Promise<StaticBlogArtifacts> {
	const now = params.now ?? new Date()
	let db = parseBlogStorageDB(await params.readStorageRaw())

	if (Object.keys(db.blogs).length === 0 && params.fallbackReadIndexRaw) {
		const fallbackRaw = await params.fallbackReadIndexRaw()
		if (fallbackRaw) {
			try {
				const parsed = JSON.parse(fallbackRaw)
				if (Array.isArray(parsed)) {
					db = buildBlogStorageFromIndex(parsed as BlogIndexItem[], now)
				}
			} catch {
				db = createEmptyBlogStorageDB(now)
			}
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
		return exportStaticBlogArtifacts(parseBlogStorageDB(storageRaw))
	}
	const index = await readIndexItemsFromRepo(token, owner, repo, branch)
	const db: BlogStorageDB = buildBlogStorageFromIndex(index)
	return exportStaticBlogArtifacts(db)
}
