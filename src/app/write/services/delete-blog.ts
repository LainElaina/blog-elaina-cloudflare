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
	TreeItem,
	updateRef
} from '@/lib/github-client'
import { prepareBlogStaticArtifacts, serializeCategoriesConfig } from '@/lib/blog-index'

export async function buildDeleteArtifactContents(params: {
	slug: string
	readStorageRaw: () => Promise<string | null>
	fallbackReadIndexRaw: () => Promise<string | null>
}): Promise<{ index: string; categories: string; folders: string; storage: string }> {
	const artifacts = await prepareBlogStaticArtifacts({
		readStorageRaw: params.readStorageRaw,
		fallbackReadIndexRaw: params.fallbackReadIndexRaw,
		removeSlugs: [params.slug]
	})

	return {
		index: JSON.stringify(artifacts.index, null, 2),
		categories: serializeCategoriesConfig(artifacts.categories),
		folders: JSON.stringify(artifacts.folders, null, 2),
		storage: JSON.stringify(artifacts.db, null, 2)
	}
}

export async function deleteBlog(slug: string): Promise<void> {
	if (!slug) throw new Error('需要 slug')

	const token = await getAuthToken()

	toast.info('正在获取分支信息...')
	const refData = await getRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `heads/${GITHUB_CONFIG.BRANCH}`)
	const latestCommitSha = refData.sha

	const basePath = `public/blogs/${slug}`

	toast.info('正在收集文章文件...')
	const files = await listRepoFilesRecursive(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, basePath, GITHUB_CONFIG.BRANCH)
	if (files.length === 0) {
		throw new Error('文章不存在或已删除')
	}

	const treeItems: TreeItem[] = files.map(path => ({
		path,
		mode: '100644',
		type: 'blob',
		sha: null
	}))

	toast.info('正在更新正式产物...')
	const artifacts = await buildDeleteArtifactContents({
		slug,
		readStorageRaw: () => readTextFileFromRepo(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, 'public/blogs/storage.json', GITHUB_CONFIG.BRANCH),
		fallbackReadIndexRaw: () => readTextFileFromRepo(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, 'public/blogs/index.json', GITHUB_CONFIG.BRANCH)
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

	toast.success('删除成功！请等待页面部署后刷新')
}
