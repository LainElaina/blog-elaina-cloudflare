import { toBase64Utf8, getRef, createTree, createCommit, updateRef, createBlob, readTextFileFromRepo, type TreeItem } from '@/lib/github-client'
import { fileToBase64NoPrefix, hashFileSHA256 } from '@/lib/file-utils'
import { getAuthToken } from '@/lib/auth'
import { GITHUB_CONFIG } from '@/consts'
import type { Project } from '../components/project-card'
import type { ImageItem } from '../components/image-upload-dialog'
import { getFileExt } from '@/lib/utils'
import { toast } from 'sonner'

export type PushProjectsParams = {
	projects: Project[]
	imageItems?: Map<string, ImageItem>
}

const PROJECT_IMAGE_PUBLIC_PREFIX = '/images/project/'
const PROJECT_IMAGE_REPO_PREFIX = 'public/images/project/'

function projectImageRepoDeletePath(publicPath: string): string | null {
	if (!publicPath.startsWith(PROJECT_IMAGE_PUBLIC_PREFIX)) {
		return null
	}
	const pathOnly = publicPath.split(/[?#]/, 1)[0]
	const filename = pathOnly.slice(PROJECT_IMAGE_PUBLIC_PREFIX.length)
	if (!filename || filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
		return null
	}
	return `${PROJECT_IMAGE_REPO_PREFIX}${filename}`
}

function collectProjectImageRepoPaths(projects: Project[]): Set<string> {
	const paths = new Set<string>()
	for (const project of projects) {
		if (!project.image) continue
		const path = projectImageRepoDeletePath(project.image)
		if (path) paths.add(path)
	}
	return paths
}

export async function pushProjects(params: PushProjectsParams): Promise<Project[]> {
	const { projects, imageItems } = params

	const token = await getAuthToken()

	toast.info('正在获取分支信息...')
	const refData = await getRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `heads/${GITHUB_CONFIG.BRANCH}`)
	const latestCommitSha = refData.sha

	const commitMessage = `更新项目列表`

	toast.info('正在准备文件...')

	const treeItems: TreeItem[] = []
	const uploadedProjectImagePaths = new Map<string, string>()
	let updatedProjects = [...projects]

	if (imageItems && imageItems.size > 0) {
		toast.info('正在上传图片...')
		for (const [url, imageItem] of imageItems.entries()) {
			if (imageItem.type === 'file') {
				const hash = imageItem.hash || (await hashFileSHA256(imageItem.file))
				const ext = getFileExt(imageItem.file.name)
				const filename = `${hash}${ext}`
				const publicPath = `/images/project/${filename}`
				const uploadKey = filename

				if (!uploadedProjectImagePaths.has(uploadKey)) {
					const path = `public/images/project/${filename}`
					const contentBase64 = await fileToBase64NoPrefix(imageItem.file)
					const blobData = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, contentBase64, 'base64')
					treeItems.push({
						path,
						mode: '100644',
						type: 'blob',
						sha: blobData.sha
					})
					uploadedProjectImagePaths.set(uploadKey, publicPath)
				}

				const uploadedPath = uploadedProjectImagePaths.get(uploadKey)!
				updatedProjects = updatedProjects.map(p => (p.url === url ? { ...p, image: uploadedPath } : p))
			}
		}
	}

	const currentImagePaths = collectProjectImageRepoPaths(updatedProjects)

	const previousListJson = await readTextFileFromRepo(
		token,
		GITHUB_CONFIG.OWNER,
		GITHUB_CONFIG.REPO,
		'src/app/projects/list.json',
		latestCommitSha
	)

	if (previousListJson) {
		try {
			const previousProjects: Project[] = JSON.parse(previousListJson)
			const previousImagePaths = collectProjectImageRepoPaths(previousProjects)

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
			console.error('Failed to parse previous projects list.json:', error)
			throw new Error('远程项目列表解析失败，请修复 src/app/projects/list.json 后重试')
		}
	}

	const projectsJson = JSON.stringify(updatedProjects, null, '\t')
	const projectsBlob = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, toBase64Utf8(projectsJson), 'base64')
	treeItems.push({
		path: 'src/app/projects/list.json',
		mode: '100644',
		type: 'blob',
		sha: projectsBlob.sha
	})

	toast.info('正在创建文件树...')
	const treeData = await createTree(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, treeItems, latestCommitSha)

	toast.info('正在创建提交...')
	const commitData = await createCommit(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, commitMessage, treeData.sha, [latestCommitSha])

	toast.info('正在更新分支...')
	await updateRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `heads/${GITHUB_CONFIG.BRANCH}`, commitData.sha)

	return updatedProjects
}

