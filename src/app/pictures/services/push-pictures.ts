import { toBase64Utf8, getRef, createTree, createCommit, updateRef, createBlob, readTextFileFromRepo, type TreeItem } from '@/lib/github-client'
import { fileToBase64NoPrefix, hashFileSHA256 } from '@/lib/file-utils'
import { getAuthToken } from '@/lib/auth'
import { GITHUB_CONFIG } from '@/consts'
import type { ImageItem } from '../../projects/components/image-upload-dialog'
import { getFileExt } from '@/lib/utils'
import { toast } from 'sonner'
import type { Picture } from '../page'

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

export async function pushPictures(params: PushPicturesParams): Promise<Picture[]> {
	const { pictures, imageItems } = params

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
		for (const [key, imageItem] of imageItems.entries()) {
			if (imageItem.type === 'file') {
				const hash = imageItem.hash || (await hashFileSHA256(imageItem.file))
				const ext = getFileExt(imageItem.file.name)
				const filename = `${hash}${ext}`
				const publicPath = `/images/pictures/${filename}`

				if (!uploadedPicturePaths.has(hash)) {
					const path = `public/images/pictures/${filename}`
					const contentBase64 = await fileToBase64NoPrefix(imageItem.file)
					const blobData = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, contentBase64, 'base64')
					treeItems.push({
						path,
						mode: '100644',
						type: 'blob',
						sha: blobData.sha
					})
					uploadedPicturePaths.set(hash, publicPath)
				}

				const uploadedPath = uploadedPicturePaths.get(hash)!
				const [groupId, indexStr] = key.split('::')
				const imageIndex = Number(indexStr) || 0

				updatedPictures = updatedPictures.map(p => {
					if (p.id !== groupId) return p

					const currentImages = p.images && p.images.length > 0 ? p.images : p.image ? [p.image] : []

					const nextImages = currentImages.map((img, idx) => (idx === imageIndex ? uploadedPath : img))

					return {
						...p,
						image: undefined,
						images: nextImages
					}
				})
			}
		}
	}

	// 收集当前所有使用的本地图片仓库路径
	const currentImagePaths = collectPictureImageRepoPaths(updatedPictures)

	// 读取之前的 list.json，找出不再使用的图片文件
	toast.info('正在检查需要删除的文件...')
	const previousListJson = await readTextFileFromRepo(
		token,
		GITHUB_CONFIG.OWNER,
		GITHUB_CONFIG.REPO,
		'src/app/pictures/list.json',
		latestCommitSha
	)

	if (previousListJson) {
		try {
			const previousPictures: Picture[] = JSON.parse(previousListJson)
			const previousImagePaths = collectPictureImageRepoPaths(previousPictures)

			// 找出不再使用的本地图片仓库路径
			for (const path of previousImagePaths) {
				if (!currentImagePaths.has(path)) {
					treeItems.push({
						path,
						mode: '100644',
						type: 'blob',
						sha: null
					})
				}
			}
		} catch (error) {
			console.error('Failed to parse previous list.json:', error)
			throw new Error('远程图床列表解析失败，请修复 src/app/pictures/list.json 后重试')
		}
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
