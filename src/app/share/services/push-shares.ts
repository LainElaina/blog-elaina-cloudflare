import {
	toBase64Utf8,
	getRef,
	createTree,
	createCommit,
	updateRef,
	createBlob,
	readTextFileFromRepo,
	listRepoFilesRecursive,
	throwStaleRemoteWriteConflictError,
	type TreeItem
} from '@/lib/github-client'
import { fileToBase64NoPrefix, hashFileSHA256 } from '@/lib/file-utils'
import { getAuthToken } from '@/lib/auth'
import { GITHUB_CONFIG } from '@/consts'
import type { Share } from '../components/share-card'
import type { LogoItem } from '../components/logo-upload-dialog'
import { assertAllowedImageFile, getImageFileExtension } from '@/lib/image-content-validation'
import { toast } from 'sonner'
import { parseRequiredShareStorageDB } from '@/lib/content-db/share-storage'
import { applyShareLogoPathUpdates, buildLocalShareSaveFilePayloads, buildUnusedShareLogoRepoPaths } from './share-artifacts'
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
	deletedPublishedUrls?: Set<string>
}

export function buildUnusedShareLogoDeleteTreeItems(previousShares: Share[], currentShares: Share[]): TreeItem[] {
	return buildUnusedShareLogoRepoPaths(previousShares, currentShares).map(path => ({
		path,
		mode: '100644',
		type: 'blob',
		sha: null
	}))
}

function collectNextShareStorageItems(storageRaw: string): Share[] {
	return Object.values(parseRequiredShareStorageDB(storageRaw).shares)
}

export function buildUnusedShareLogoDeleteTreeItemsForStorage(previousShares: Share[], currentShares: Share[], storageRaw: string): TreeItem[] {
	return buildUnusedShareLogoDeleteTreeItems(previousShares, [...currentShares, ...collectNextShareStorageItems(storageRaw)])
}

export function filterExistingShareLogoDeleteTreeItems(deleteItems: TreeItem[], existingRepoPaths: Iterable<string>): TreeItem[] {
	const existing = new Set(existingRepoPaths)
	return deleteItems.filter(item => existing.has(item.path))
}

function parsePreviousShareList(previousListJson: string | null): Share[] {
	if (!previousListJson) {
		return []
	}
	try {
		const previousShares = JSON.parse(previousListJson)
		if (!Array.isArray(previousShares)) {
			throw new Error('invalid share list')
		}
		return previousShares
	} catch (error) {
		console.error('Failed to parse previous share list.json:', error)
		throw new Error('远程分享列表解析失败，请修复 public/share/list.json 后重试')
	}
}

function parseJsonResult<T>(content: string): T {
	return JSON.parse(content) as T
}

export function buildRemoteShareArtifactContents(params: {
	shares: Share[]
	existingStorageRaw: string | null
	urlMappings?: ShareUrlMapping[]
	deletedPublishedUrls?: Set<string>
}): { list: string; categories: string; folders: string; storage: string } {
	const renamedUrls = new Map<string, string>()
	for (const mapping of params.urlMappings ?? []) {
		if (mapping.oldUrl !== mapping.currentUrl) {
			renamedUrls.set(mapping.currentUrl, mapping.oldUrl)
		}
	}
	const payloads = buildLocalShareSaveFilePayloads(params.shares, params.existingStorageRaw, renamedUrls, params.deletedPublishedUrls, {
		preserveUnlistedPublished: true
	})
	const list = payloads.find(payload => payload.path === 'public/share/list.json')?.content
	const categories = payloads.find(payload => payload.path === 'public/share/categories.json')?.content
	const folders = payloads.find(payload => payload.path === 'public/share/folders.json')?.content
	const storage = payloads.find(payload => payload.path === 'public/share/storage.json')?.content
	if (!list || !categories || !folders || !storage) {
		throw new Error('share 正式产物不完整')
	}
	return { list, categories, folders, storage }
}

export async function pushShares(params: PushSharesParams): Promise<PushSharesResult> {
	const { shares, logoItems, urlMappings, deletedPublishedUrls } = params

	async function attemptPushShares(): Promise<PushSharesResult> {
		const token = await getAuthToken()

		toast.info('正在获取分支信息...')
		const refData = await getRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `heads/${GITHUB_CONFIG.BRANCH}`)
		const latestCommitSha = refData.sha

		const commitMessage = `更新分享正式产物`

		toast.info('正在准备文件...')

		const treeItems: TreeItem[] = []
		const uploadedLogoPaths = new Map<string, string>()
		const nextLogoPaths = new Map<string, string>()

		if (logoItems && logoItems.size > 0) {
			toast.info('正在上传图标...')
			for (const [url, logoItem] of logoItems.entries()) {
				if (logoItem.type === 'file') {
					const ext = getImageFileExtension(logoItem.file.name)
					await assertAllowedImageFile(logoItem.file, ext)
					const hash = logoItem.hash || (await hashFileSHA256(logoItem.file))
					const filename = `${hash}${ext}`
					const publicPath = `/images/share/${filename}`
					const uploadKey = filename

					if (!uploadedLogoPaths.has(uploadKey)) {
						const path = `public/images/share/${filename}`
						const contentBase64 = await fileToBase64NoPrefix(logoItem.file)
						const blobData = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, contentBase64, 'base64')
						treeItems.push({
							path,
							mode: '100644',
							type: 'blob',
							sha: blobData.sha
						})
						uploadedLogoPaths.set(uploadKey, publicPath)
					}

					nextLogoPaths.set(url, uploadedLogoPaths.get(uploadKey)!)
				}
			}
		}

		const updatedShares = applyShareLogoPathUpdates(shares, nextLogoPaths)
		const previousListJson = await readTextFileFromRepo(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, 'public/share/list.json', latestCommitSha)
		const previousShares = parsePreviousShareList(previousListJson)
		const existingStorageRaw = await readTextFileFromRepo(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, 'public/share/storage.json', latestCommitSha)
		const artifactContents = buildRemoteShareArtifactContents({
			shares: updatedShares,
			existingStorageRaw,
			urlMappings,
			deletedPublishedUrls
		})
		const payloads = [
			{ path: 'public/share/list.json', content: artifactContents.list },
			{ path: 'public/share/categories.json', content: artifactContents.categories },
			{ path: 'public/share/folders.json', content: artifactContents.folders },
			{ path: 'public/share/storage.json', content: artifactContents.storage }
		]
		const existingShareLogoPaths = await listRepoFilesRecursive(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, 'public/images/share', latestCommitSha)
		const deleteTreeItems = filterExistingShareLogoDeleteTreeItems(
			buildUnusedShareLogoDeleteTreeItemsForStorage(previousShares, updatedShares, artifactContents.storage),
			existingShareLogoPaths
		)
		treeItems.push(...deleteTreeItems)

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

		return {
			list: parseJsonResult<Share[]>(artifactContents.list),
			categories: parseJsonResult<ShareCategoriesArtifact>(artifactContents.categories),
			folders: parseJsonResult<ShareFolderNode[]>(artifactContents.folders)
		}
	}

	try {
		return await attemptPushShares()
	} catch (error) {
		throwStaleRemoteWriteConflictError(error)
	}
}
