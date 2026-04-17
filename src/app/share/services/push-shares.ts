import { toBase64Utf8, getRef, createTree, createCommit, updateRef, createBlob, readTextFileFromRepo, type TreeItem } from '@/lib/github-client'
import { fileToBase64NoPrefix, hashFileSHA256 } from '@/lib/file-utils'
import { getAuthToken } from '@/lib/auth'
import { GITHUB_CONFIG } from '@/consts'
import type { Share } from '../components/share-card'
import type { LogoItem } from '../components/logo-upload-dialog'
import { getFileExt } from '@/lib/utils'
import { toast } from 'sonner'
import { applyShareLogoPathUpdates, buildLocalShareSaveFilePayloads } from './share-artifacts'
import type { ShareUrlMapping as ShareUrlMappingContract } from '../components/share-folder-select-view-model'
import type { ShareCategoriesArtifact } from '../share-page-state'
import type { ShareFolderNode } from '../share-runtime'

type ShareUrlMapping = ShareUrlMappingContract

export type PushSharesResult = {
	list: Share[]
	categories: ShareCategoriesArtifact
	folders: ShareFolderNode[]
}

export type PushSharesParams = {
	shares: Share[]
	logoItems?: Map<string, LogoItem>
	urlMappings?: ShareUrlMapping[]
}

export async function pushShares(params: PushSharesParams): Promise<PushSharesResult> {
	const { shares, logoItems, urlMappings } = params

	const token = await getAuthToken()

	toast.info('正在获取分支信息...')
	const refData = await getRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `heads/${GITHUB_CONFIG.BRANCH}`)
	const latestCommitSha = refData.sha

	const commitMessage = `更新分享正式产物`

	toast.info('正在准备文件...')

	const treeItems: TreeItem[] = []
	const uploadedHashes = new Set<string>()
	const nextLogoPaths = new Map<string, string>()

	if (logoItems && logoItems.size > 0) {
		toast.info('正在上传图标...')
		for (const [url, logoItem] of logoItems.entries()) {
			if (logoItem.type === 'file') {
				const hash = logoItem.hash || (await hashFileSHA256(logoItem.file))
				const ext = getFileExt(logoItem.file.name)
				const filename = `${hash}${ext}`
				const publicPath = `/images/share/${filename}`

				if (!uploadedHashes.has(hash)) {
					const path = `public/images/share/${filename}`
					const contentBase64 = await fileToBase64NoPrefix(logoItem.file)
					const blobData = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, contentBase64, 'base64')
					treeItems.push({
						path,
						mode: '100644',
						type: 'blob',
						sha: blobData.sha
					})
					uploadedHashes.add(hash)
				}

				nextLogoPaths.set(url, publicPath)
			}
		}
	}

	const updatedShares = applyShareLogoPathUpdates(shares, nextLogoPaths)
	const renamedUrls = new Map<string, string>()
	for (const mapping of urlMappings ?? []) {
		if (mapping.oldUrl !== mapping.currentUrl) {
			renamedUrls.set(mapping.currentUrl, mapping.oldUrl)
		}
	}
	const existingStorageRaw = await readTextFileFromRepo(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, 'public/share/storage.json', GITHUB_CONFIG.BRANCH)
	const payloads = buildLocalShareSaveFilePayloads(updatedShares, existingStorageRaw, renamedUrls)

	for (const payload of payloads) {
		const blob = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, toBase64Utf8(payload.content), 'base64')
		treeItems.push({
			path: payload.path,
			mode: '100644',
			type: 'blob',
			sha: blob.sha
		})
	}

	toast.info('正在创建文件树...')
	const treeData = await createTree(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, treeItems, latestCommitSha)

	toast.info('正在创建提交...')
	const commitData = await createCommit(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, commitMessage, treeData.sha, [latestCommitSha])

	toast.info('正在更新分支...')
	await updateRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `heads/${GITHUB_CONFIG.BRANCH}`, commitData.sha)

	const listPayload = payloads.find(payload => payload.path === 'public/share/list.json')
	const categoriesPayload = payloads.find(payload => payload.path === 'public/share/categories.json')
	const foldersPayload = payloads.find(payload => payload.path === 'public/share/folders.json')

	toast.success('发布成功！')
	return {
		list: listPayload ? (JSON.parse(listPayload.content) as Share[]) : updatedShares,
		categories: categoriesPayload ? (JSON.parse(categoriesPayload.content) as ShareCategoriesArtifact) : { categories: [] },
		folders: foldersPayload ? (JSON.parse(foldersPayload.content) as ShareFolderNode[]) : []
	}
}
