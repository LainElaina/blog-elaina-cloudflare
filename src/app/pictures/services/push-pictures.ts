import {
	toBase64Utf8,
	getRef,
	createTree,
	createCommit,
	updateRef,
	createBlob,
	readTextFileFromRepo,
	listRepoFilesRecursive,
	isGitHubUpdateRefConflictError,
	type TreeItem
} from '@/lib/github-client'
import { fileToBase64NoPrefix, hashFileSHA256 } from '@/lib/file-utils'
import { assertAllowedImageFile, getImageFileExtension } from '@/lib/image-content-validation'
import { getAuthToken } from '@/lib/auth'
import { GITHUB_CONFIG } from '@/consts'
import type { ImageItem } from '../../projects/components/image-upload-dialog'
import { toast } from 'sonner'
import type { Picture } from '../page'
import { applyPictureImagePathReplacements, isPictureImageReplacementKey } from '../page-view-model'

export type PushPicturesParams = {
	pictures: Picture[]
	imageItems?: Map<string, ImageItem>
}

const PICTURE_IMAGE_PUBLIC_PREFIX = '/images/pictures/'
const PICTURE_IMAGE_REPO_PREFIX = 'public/images/pictures/'

function pictureImageRepoDeletePath(publicPath: string): string | null {
	if (!publicPath.startsWith(PICTURE_IMAGE_PUBLIC_PREFIX)) {
		return null
	}
	const pathOnly = publicPath.split(/[?#]/, 1)[0]
	const filename = pathOnly.slice(PICTURE_IMAGE_PUBLIC_PREFIX.length)
	if (!filename || filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
		return null
	}
	return `${PICTURE_IMAGE_REPO_PREFIX}${filename}`
}

function collectPictureImageRepoPaths(pictures: Picture[]): Set<string> {
	const paths = new Set<string>()
	for (const picture of pictures) {
		if (picture.image) {
			const path = pictureImageRepoDeletePath(picture.image)
			if (path) paths.add(path)
		}
		for (const image of picture.images ?? []) {
			const path = pictureImageRepoDeletePath(image)
			if (path) paths.add(path)
		}
	}
	return paths
}

export function buildUnusedPictureImageDeleteTreeItems(previousPictures: Picture[], currentPictures: Picture[]): TreeItem[] {
	const currentImagePaths = collectPictureImageRepoPaths(currentPictures)
	return Array.from(collectPictureImageRepoPaths(previousPictures)).flatMap(path =>
		currentImagePaths.has(path)
			? []
			: [
					{
						path,
						mode: '100644' as const,
						type: 'blob' as const,
						sha: null
					}
				]
	)
}

export function filterExistingPictureImageDeleteTreeItems(deleteItems: TreeItem[], existingRepoPaths: Iterable<string>): TreeItem[] {
	const existing = new Set(existingRepoPaths)
	return deleteItems.filter(item => existing.has(item.path))
}

function parsePreviousPictureList(previousListJson: string | null): Picture[] {
	if (!previousListJson) {
		return []
	}
	try {
		const previousPictures = JSON.parse(previousListJson)
		if (!Array.isArray(previousPictures)) {
			throw new Error('invalid picture list')
		}
		return previousPictures
	} catch (error) {
		console.error('Failed to parse previous pictures list.json:', error)
		throw new Error('远程图床列表解析失败，请修复 src/app/pictures/list.json 后重试')
	}
}

export async function pushPictures(params: PushPicturesParams): Promise<Picture[]> {
	const { pictures, imageItems } = params

	async function attemptPushPictures(): Promise<Picture[]> {
		const token = await getAuthToken()

		toast.info('正在获取分支信息...')
		const refData = await getRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `heads/${GITHUB_CONFIG.BRANCH}`)
		const latestCommitSha = refData.sha

		const commitMessage = `更新图床列表`

		toast.info('正在准备文件...')

		const treeItems: TreeItem[] = []
		const uploadedPicturePaths = new Map<string, string>()
		let updatedPictures = [...pictures]

		if (imageItems && imageItems.size > 0) {
			toast.info('正在上传图片...')
			const pathReplacements = new Map<string, string>()
			for (const [key, imageItem] of imageItems.entries()) {
				if (imageItem.type === 'file' && isPictureImageReplacementKey(key)) {
					const ext = getImageFileExtension(imageItem.file.name)
					await assertAllowedImageFile(imageItem.file, ext)
					const hash = imageItem.hash || (await hashFileSHA256(imageItem.file))
					const filename = `${hash}${ext}`
					const publicPath = `/images/pictures/${filename}`
					const uploadKey = filename

					if (!uploadedPicturePaths.has(uploadKey)) {
						const path = `public/images/pictures/${filename}`
						const contentBase64 = await fileToBase64NoPrefix(imageItem.file)
						const blobData = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, contentBase64, 'base64')
						treeItems.push({
							path,
							mode: '100644',
							type: 'blob',
							sha: blobData.sha
						})
						uploadedPicturePaths.set(uploadKey, publicPath)
					}

					pathReplacements.set(key, uploadedPicturePaths.get(uploadKey)!)
				}
			}
			updatedPictures = applyPictureImagePathReplacements(updatedPictures, pathReplacements)
		}

		toast.info('正在检查需要删除的文件...')
		const previousListJson = await readTextFileFromRepo(
			token,
			GITHUB_CONFIG.OWNER,
			GITHUB_CONFIG.REPO,
			'src/app/pictures/list.json',
			latestCommitSha
		)
		const previousPictures = parsePreviousPictureList(previousListJson)

		if (previousPictures.length > 0) {
			const existingPictureImagePaths = await listRepoFilesRecursive(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, 'public/images/pictures', latestCommitSha)
			const deleteTreeItems = filterExistingPictureImageDeleteTreeItems(
				buildUnusedPictureImageDeleteTreeItems(previousPictures, updatedPictures),
				existingPictureImagePaths
			)
			treeItems.push(...deleteTreeItems)
		}

		const picturesJson = JSON.stringify(updatedPictures, null, '\t')
		const picturesBlob = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, toBase64Utf8(picturesJson), 'base64')
		treeItems.push({
			path: 'src/app/pictures/list.json',
			mode: '100644',
			type: 'blob',
			sha: picturesBlob.sha
		})

		toast.info('正在创建文件树...')
		const treeData = await createTree(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, treeItems, latestCommitSha)

		toast.info('正在创建提交...')
		const commitData = await createCommit(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, commitMessage, treeData.sha, [latestCommitSha])

		toast.info('正在更新分支...')
		await updateRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `heads/${GITHUB_CONFIG.BRANCH}`, commitData.sha)

		return updatedPictures
	}

	try {
		return await attemptPushPictures()
	} catch (error) {
		if (isGitHubUpdateRefConflictError(error)) {
			toast.info('分支已更新，正在重新发布...')
			return attemptPushPictures()
		}
		throw error
	}
}
