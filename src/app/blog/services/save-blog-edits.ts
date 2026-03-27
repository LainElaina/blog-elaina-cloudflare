import { toast } from 'sonner'
import { GITHUB_CONFIG } from '@/consts'
import { getAuthToken } from '@/lib/auth'
import { createBlob, createCommit, createTree, getRef, listRepoFilesRecursive, readTextFileFromRepo, toBase64Utf8, type TreeItem, updateRef } from '@/lib/github-client'
import type { BlogIndexItem } from '@/lib/blog-index'
import { serializeCategoriesConfig } from '@/lib/blog-index'
import { exportStaticBlogArtifacts, parseBlogStorageDB, removeBlogRecord, upsertBlogRecord, type BlogStorageDB } from '@/lib/content-db/blog-storage'
import type { BlogFolderNode } from '@/lib/content-db/blog-folders'
import { buildLocalSaveFilePayloadsFromContents, mergeCategoriesForSave, type LocalSaveFilePayload } from './save-blog-edits-utils'

export type SaveBlogEditsArtifacts = {
	removedSlugs: string[]
	index: BlogIndexItem[]
	categories: string[]
	folders: BlogFolderNode[]
	storage: BlogStorageDB
}

export function buildArtifactsForSaveBlogEdits(params: {
	originalItems: BlogIndexItem[]
	nextItems: BlogIndexItem[]
	categories: string[]
	existingStorageRaw: string | null
	now?: Date
}): SaveBlogEditsArtifacts {
	const { originalItems, nextItems, categories: explicitCategories, existingStorageRaw } = params
	const now = params.now ?? new Date()
	const removedSlugs = originalItems.filter(item => !nextItems.some(next => next.slug === item.slug)).map(item => item.slug)
	const uniqueRemoved = Array.from(new Set(removedSlugs.filter(Boolean)))
	let db = parseBlogStorageDB(existingStorageRaw)

	for (const item of nextItems) {
		db = upsertBlogRecord(db, item, { now })
	}
	for (const slug of uniqueRemoved) {
		db = removeBlogRecord(db, slug, now)
	}

	const exported = exportStaticBlogArtifacts(db)
	const mergedCategories = mergeCategoriesForSave(explicitCategories, exported.categories)

	return {
		removedSlugs: uniqueRemoved,
		index: exported.index,
		categories: mergedCategories,
		folders: exported.folders,
		storage: exported.db
	}
}

export function buildLocalSaveFilePayloads(params: {
	originalItems: BlogIndexItem[]
	nextItems: BlogIndexItem[]
	categories: string[]
	existingStorageRaw: string | null
	now?: Date
}): LocalSaveFilePayload[] {
	const artifacts = buildArtifactsForSaveBlogEdits(params)
	return buildLocalSaveFilePayloadsFromContents({
		index: JSON.stringify(artifacts.index, null, 2),
		categories: serializeCategoriesConfig(artifacts.categories),
		folders: JSON.stringify(artifacts.folders, null, 2),
		storage: JSON.stringify(artifacts.storage, null, 2)
	})
}

export async function saveBlogEdits(originalItems: BlogIndexItem[], nextItems: BlogIndexItem[], categories: string[]): Promise<void> {
	const token = await getAuthToken()

	toast.info('正在获取分支信息...')
	const refData = await getRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `heads/${GITHUB_CONFIG.BRANCH}`)
	const latestCommitSha = refData.sha

	const treeItems: TreeItem[] = []
	const storagePath = 'public/blogs/storage.json'
	let storageRaw: string | null = null
	try {
		storageRaw = await readTextFileFromRepo(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, storagePath, GITHUB_CONFIG.BRANCH)
	} catch {
		storageRaw = null
	}

	const artifacts = buildArtifactsForSaveBlogEdits({
		originalItems,
		nextItems,
		categories,
		existingStorageRaw: storageRaw
	})

	for (const slug of artifacts.removedSlugs) {
		toast.info(`正在收集 ${slug} 文件...`)
		const basePath = `public/blogs/${slug}`
		const files = await listRepoFilesRecursive(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, basePath, GITHUB_CONFIG.BRANCH)

		for (const path of files) {
			treeItems.push({
				path,
				mode: '100644',
				type: 'blob',
				sha: null
			})
		}
	}

	toast.info('正在更新索引...')
	const indexJson = JSON.stringify(artifacts.index, null, 2)
	const indexBlob = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, toBase64Utf8(indexJson), 'base64')
	treeItems.push({
		path: 'public/blogs/index.json',
		mode: '100644',
		type: 'blob',
		sha: indexBlob.sha
	})

	toast.info('正在更新分类...')
	const categoriesJson = serializeCategoriesConfig(artifacts.categories)
	const categoriesBlob = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, toBase64Utf8(categoriesJson), 'base64')
	treeItems.push({
		path: 'public/blogs/categories.json',
		mode: '100644',
		type: 'blob',
		sha: categoriesBlob.sha
	})

	toast.info('正在更新目录...')
	const foldersJson = JSON.stringify(artifacts.folders, null, 2)
	const foldersBlob = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, toBase64Utf8(foldersJson), 'base64')
	treeItems.push({
		path: 'public/blogs/folders.json',
		mode: '100644',
		type: 'blob',
		sha: foldersBlob.sha
	})

	toast.info('正在更新存储快照...')
	const storageJson = JSON.stringify(artifacts.storage, null, 2)
	const storageBlob = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, toBase64Utf8(storageJson), 'base64')
	treeItems.push({
		path: storagePath,
		mode: '100644',
		type: 'blob',
		sha: storageBlob.sha
	})

	toast.info('正在创建提交...')
	const treeData = await createTree(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, treeItems, latestCommitSha)
	const actionLabels: string[] = []
	if (artifacts.removedSlugs.length > 0) {
		actionLabels.push(`删除:${artifacts.removedSlugs.join(',')}`)
	}
	actionLabels.push('更新索引')
	if (artifacts.categories.length > 0) {
		actionLabels.push('更新分类')
	}
	actionLabels.push('更新存储')
	const commitLabel = actionLabels.join(' | ')
	const commitData = await createCommit(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, commitLabel, treeData.sha, [latestCommitSha])

	toast.info('正在更新分支...')
	await updateRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `heads/${GITHUB_CONFIG.BRANCH}`, commitData.sha)

	toast.success('保存成功！请等待页面部署后刷新')
}
