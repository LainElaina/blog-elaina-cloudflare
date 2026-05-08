import { toast } from 'sonner'
import { getAuthToken } from '@/lib/auth'
import { GITHUB_CONFIG } from '@/consts'
import {
	createBlob,
	createCommit,
	createTree,
	getRef,
	listRepoFilesRecursive,
	readTextFileFromRepo,
	toBase64Utf8,
	isGitHubUpdateRefConflictError,
	updateRef
} from '@/lib/github-client'
import type { TreeItem } from '@/lib/github-client'
import { parseBlogIndexItemsRaw, prepareBlogStaticArtifacts, serializeCategoriesConfig } from '@/lib/blog-index'
import { parseRequiredBlogStorageDB } from '@/lib/content-db/blog-storage'
import { assertSafeBlogSlug } from './blog-slug'

export async function buildDeleteArtifactContents(params: {
	slug: string
	readStorageRaw: () => Promise<string | null>
	fallbackReadIndexRaw: () => Promise<string | null>
}): Promise<{ index: string; categories: string; folders: string; storage: string }> {
	assertSafeBlogSlug(params.slug)
	return buildBatchDeleteArtifactContents({
		slugs: [params.slug],
		readStorageRaw: params.readStorageRaw,
		fallbackReadIndexRaw: params.fallbackReadIndexRaw
	})
}

export async function buildBatchDeleteArtifactContents(params: {
	slugs: string[]
	readStorageRaw: () => Promise<string | null>
	fallbackReadIndexRaw: () => Promise<string | null>
}): Promise<{ index: string; categories: string; folders: string; storage: string }> {
	const uniqueSlugs = Array.from(new Set(params.slugs))
	for (const slug of uniqueSlugs) {
		assertSafeBlogSlug(slug)
	}
	const artifacts = await prepareBlogStaticArtifacts({
		readStorageRaw: params.readStorageRaw,
		fallbackReadIndexRaw: params.fallbackReadIndexRaw,
		removeSlugs: uniqueSlugs
	})

	return {
		index: JSON.stringify(artifacts.index, null, 2),
		categories: serializeCategoriesConfig(artifacts.categories),
		folders: JSON.stringify(artifacts.folders, null, 2),
		storage: JSON.stringify(artifacts.db, null, 2)
	}
}

export function hasBlogRecordForDelete(params: { slug: string; storageRaw: string | null; indexRaw: string | null }): boolean {
	assertSafeBlogSlug(params.slug)
	const storage = parseRequiredBlogStorageDB(params.storageRaw)
	if (storage.blogs[params.slug]) {
		return true
	}
	if (!params.storageRaw && params.indexRaw) {
		return parseBlogIndexItemsRaw(params.indexRaw).some(item => item.slug === params.slug)
	}
	return false
}

export async function deleteBlog(slug: string): Promise<void> {
	if (!slug) throw new Error('需要 slug')
	assertSafeBlogSlug(slug)

	const token = await getAuthToken()

	async function attemptDeleteBlog() {
		toast.info('正在获取分支信息...')
		const refData = await getRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `heads/${GITHUB_CONFIG.BRANCH}`)
		const latestCommitSha = refData.sha

		const basePath = `public/blogs/${slug}`

		toast.info('正在收集文章文件...')
		const files = await listRepoFilesRecursive(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, basePath, latestCommitSha)
		let storageRaw: string | null | undefined
		let indexRaw: string | null | undefined
		if (files.length === 0) {
			storageRaw = await readTextFileFromRepo(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, 'public/blogs/storage.json', latestCommitSha)
			indexRaw = await readTextFileFromRepo(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, 'public/blogs/index.json', latestCommitSha)
			if (!hasBlogRecordForDelete({ slug, storageRaw, indexRaw })) {
				throw new Error('文章不存在或已删除')
			}
		}

		const treeItems: TreeItem[] = files.map(path => ({
			path,
			mode: '100644',
			type: 'blob',
			sha: null
		}))

		toast.info('正在更新正式产物...')
		const artifactStorageRaw = storageRaw === undefined ? await readTextFileFromRepo(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, 'public/blogs/storage.json', latestCommitSha) : storageRaw
		const artifactIndexRaw = indexRaw === undefined ? await readTextFileFromRepo(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, 'public/blogs/index.json', latestCommitSha) : indexRaw
		const artifacts = await buildDeleteArtifactContents({
			slug,
			readStorageRaw: async () => artifactStorageRaw,
			fallbackReadIndexRaw: async () => artifactIndexRaw
		})

		const indexBlob = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, toBase64Utf8(artifacts.index), 'base64')
		treeItems.push({ path: 'public/blogs/index.json', mode: '100644', type: 'blob', sha: indexBlob.sha })

		const categoriesBlob = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, toBase64Utf8(artifacts.categories), 'base64')
		treeItems.push({ path: 'public/blogs/categories.json', mode: '100644', type: 'blob', sha: categoriesBlob.sha })

		const foldersBlob = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, toBase64Utf8(artifacts.folders), 'base64')
		treeItems.push({ path: 'public/blogs/folders.json', mode: '100644', type: 'blob', sha: foldersBlob.sha })

		const storageBlob = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, toBase64Utf8(artifacts.storage), 'base64')
		treeItems.push({ path: 'public/blogs/storage.json', mode: '100644', type: 'blob', sha: storageBlob.sha })

		toast.info('正在创建提交...')
		const treeData = await createTree(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, treeItems, latestCommitSha)
		const commitData = await createCommit(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `删除文章: ${slug}`, treeData.sha, [latestCommitSha])

		toast.info('正在更新分支...')
		await updateRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `heads/${GITHUB_CONFIG.BRANCH}`, commitData.sha)
	}

	try {
		await attemptDeleteBlog()
	} catch (error) {
		if (isGitHubUpdateRefConflictError(error)) {
			toast.info('分支已更新，正在重新删除...')
			await attemptDeleteBlog()
		} else {
			throw error
		}
	}

	toast.success('删除成功！请等待页面部署后刷新')
}
