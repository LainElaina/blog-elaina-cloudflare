import { toast } from 'sonner'
import { getAuthToken } from '@/lib/auth'
import { GITHUB_CONFIG } from '@/consts'
import { createBlob, createCommit, createTree, getRef, listRepoFilesRecursive, readTextFileFromRepo, toBase64Utf8, type TreeItem, updateRef } from '@/lib/github-client'
import { buildBatchDeleteArtifactContents } from '../../write/services/delete-blog'

export async function batchDeleteBlogs(slugs: string[]): Promise<void> {
	const uniqueSlugs = Array.from(new Set(slugs.filter(Boolean)))
	if (uniqueSlugs.length === 0) {
		throw new Error('需要至少选择一篇文章')
	}

	const token = await getAuthToken()

	toast.info('正在获取分支信息...')
	const refData = await getRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `heads/${GITHUB_CONFIG.BRANCH}`)
	const latestCommitSha = refData.sha

	const treeItems: TreeItem[] = []

	for (const slug of uniqueSlugs) {
		toast.info(`正在收集 ${slug} 文件...`)
		const basePath = `public/blogs/${slug}`
		const files = await listRepoFilesRecursive(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, basePath, latestCommitSha)

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
	const artifactContents = await buildBatchDeleteArtifactContents({
		slugs: uniqueSlugs,
		readStorageRaw: () => readTextFileFromRepo(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, 'public/blogs/storage.json', latestCommitSha),
		fallbackReadIndexRaw: () => readTextFileFromRepo(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, 'public/blogs/index.json', latestCommitSha)
	})

	const indexBlob = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, toBase64Utf8(artifactContents.index), 'base64')
	treeItems.push({ path: 'public/blogs/index.json', mode: '100644', type: 'blob', sha: indexBlob.sha })

	const categoriesBlob = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, toBase64Utf8(artifactContents.categories), 'base64')
	treeItems.push({ path: 'public/blogs/categories.json', mode: '100644', type: 'blob', sha: categoriesBlob.sha })

	const foldersBlob = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, toBase64Utf8(artifactContents.folders), 'base64')
	treeItems.push({ path: 'public/blogs/folders.json', mode: '100644', type: 'blob', sha: foldersBlob.sha })

	const storageBlob = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, toBase64Utf8(artifactContents.storage), 'base64')
	treeItems.push({ path: 'public/blogs/storage.json', mode: '100644', type: 'blob', sha: storageBlob.sha })

	toast.info('正在创建提交...')
	const treeData = await createTree(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, treeItems, latestCommitSha)
	const commitLabel = uniqueSlugs.length === 1 ? `删除文章: ${uniqueSlugs[0]}` : `批量删除文章: ${uniqueSlugs.join(', ')}`
	const commitData = await createCommit(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, commitLabel, treeData.sha, [latestCommitSha])

	toast.info('正在更新分支...')
	await updateRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `heads/${GITHUB_CONFIG.BRANCH}`, commitData.sha)

	toast.success('删除成功！请等待页面部署后刷新')
}

