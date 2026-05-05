import { toBase64Utf8, getRef, createTree, createCommit, updateRef, createBlob, readTextFileFromRepo, type TreeItem } from '@/lib/github-client'
import { fileToBase64NoPrefix, hashFileSHA256 } from '@/lib/file-utils'
import { getAuthToken } from '@/lib/auth'
import { GITHUB_CONFIG } from '@/consts'
import type { Blogger } from '../grid-view'
import type { AvatarItem } from '../components/avatar-upload-dialog'
import { getFileExt } from '@/lib/utils'
import { toast } from 'sonner'

export type PushBloggersParams = {
	bloggers: Blogger[]
	avatarItems?: Map<string, AvatarItem>
}

const BLOGGER_AVATAR_PUBLIC_PREFIX = '/images/blogger/'
const BLOGGER_AVATAR_REPO_PREFIX = 'public/images/blogger/'

function bloggerAvatarRepoDeletePath(publicPath: string): string | null {
	if (!publicPath.startsWith(BLOGGER_AVATAR_PUBLIC_PREFIX)) {
		return null
	}
	const pathOnly = publicPath.split(/[?#]/, 1)[0]
	const filename = pathOnly.slice(BLOGGER_AVATAR_PUBLIC_PREFIX.length)
	if (!filename || filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
		return null
	}
	return `${BLOGGER_AVATAR_REPO_PREFIX}${filename}`
}

function collectBloggerAvatarRepoPaths(bloggers: Blogger[]): Set<string> {
	const paths = new Set<string>()
	for (const blogger of bloggers) {
		if (!blogger.avatar) continue
		const path = bloggerAvatarRepoDeletePath(blogger.avatar)
		if (path) paths.add(path)
	}
	return paths
}

export async function pushBloggers(params: PushBloggersParams): Promise<Blogger[]> {
	const { bloggers, avatarItems } = params

	// 获取认证 token（自动从全局认证状态获取）
	const token = await getAuthToken()

	toast.info('正在获取分支信息...')
	const refData = await getRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `heads/${GITHUB_CONFIG.BRANCH}`)
	const latestCommitSha = refData.sha

	const commitMessage = `更新博主列表`

	toast.info('正在准备文件...')

	const treeItems: TreeItem[] = []
	const uploadedAvatarPaths = new Map<string, string>()
	let updatedBloggers = [...bloggers]

	// Process avatar uploads
	if (avatarItems && avatarItems.size > 0) {
		toast.info('正在上传头像...')
		for (const [url, avatarItem] of avatarItems.entries()) {
			if (avatarItem.type === 'file') {
				const hash = avatarItem.hash || (await hashFileSHA256(avatarItem.file))
				const ext = getFileExt(avatarItem.file.name)
				const filename = `${hash}${ext}`
				const publicPath = `/images/blogger/${filename}`
				const uploadKey = filename

				if (!uploadedAvatarPaths.has(uploadKey)) {
					const path = `public/images/blogger/${filename}`
					const contentBase64 = await fileToBase64NoPrefix(avatarItem.file)
					const blobData = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, contentBase64, 'base64')
					treeItems.push({
						path,
						mode: '100644',
						type: 'blob',
						sha: blobData.sha
					})
					uploadedAvatarPaths.set(uploadKey, publicPath)
				}

				const uploadedPath = uploadedAvatarPaths.get(uploadKey)!
				updatedBloggers = updatedBloggers.map(b => (b.url === url ? { ...b, avatar: uploadedPath } : b))
			}
		}
	}

	const currentAvatarPaths = collectBloggerAvatarRepoPaths(updatedBloggers)

	const previousListJson = await readTextFileFromRepo(
		token,
		GITHUB_CONFIG.OWNER,
		GITHUB_CONFIG.REPO,
		'src/app/bloggers/list.json',
		latestCommitSha
	)

	if (previousListJson) {
		try {
			const previousBloggers: Blogger[] = JSON.parse(previousListJson)
			const previousAvatarPaths = collectBloggerAvatarRepoPaths(previousBloggers)

			for (const path of previousAvatarPaths) {
				if (!currentAvatarPaths.has(path)) {
					treeItems.push({
						path,
						mode: '100644',
						type: 'blob',
						sha: null
					})
				}
			}
		} catch (error) {
			console.error('Failed to parse previous bloggers list.json:', error)
			throw new Error('远程友链列表解析失败，请修复 src/app/bloggers/list.json 后重试')
		}
	}

	// Create blob for bloggers list.json
	const bloggersJson = JSON.stringify(updatedBloggers, null, '\t')
	const bloggersBlob = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, toBase64Utf8(bloggersJson), 'base64')
	treeItems.push({
		path: 'src/app/bloggers/list.json',
		mode: '100644',
		type: 'blob',
		sha: bloggersBlob.sha
	})

	// Create tree
	toast.info('正在创建文件树...')
	const treeData = await createTree(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, treeItems, latestCommitSha)

	// Create commit
	toast.info('正在创建提交...')
	const commitData = await createCommit(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, commitMessage, treeData.sha, [latestCommitSha])

	// Update branch reference
	toast.info('正在更新分支...')
	await updateRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `heads/${GITHUB_CONFIG.BRANCH}`, commitData.sha)

	return updatedBloggers
}
