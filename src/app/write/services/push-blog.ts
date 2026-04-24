import { toBase64Utf8, getRef, createTree, createCommit, updateRef, createBlob, type TreeItem, readTextFileFromRepo } from '@/lib/github-client'
import { fileToBase64NoPrefix, hashFileSHA256 } from '@/lib/file-utils'
import { prepareBlogStaticArtifacts, serializeCategoriesConfig } from '@/lib/blog-index'
import type { BlogIndexItem } from '@/lib/blog-index'
import { getAuthToken } from '@/lib/auth'
import { GITHUB_CONFIG } from '@/consts'
import type { ImageItem } from '../types'
import { getFileExt } from '@/lib/utils'
import { toast } from 'sonner'
import { getWritePublishSafetyState, replaceLocalImagePlaceholders } from '../write-safety'
import { formatDateTimeLocal } from '../stores/write-store'

export type PushBlogParams = {
	form: {
		slug: string
		title: string
		md: string
		tags: string[]
		date?: string
		summary?: string
		hidden?: boolean
		category?: string
		folderPath?: string
		favorite?: boolean
	}
	cover?: ImageItem | null
	images?: ImageItem[]
	mode?: 'create' | 'edit'
	originalSlug?: string | null
}

export function buildBlogUpsertItem(form: PushBlogParams['form'], dateStr: string, coverPath?: string): BlogIndexItem {
	return {
		slug: form.slug,
		title: form.title,
		tags: form.tags,
		date: dateStr,
		summary: form.summary,
		cover: coverPath,
		hidden: form.hidden,
		category: form.category,
		folderPath: form.folderPath,
		favorite: form.favorite
	}
}

export async function buildRemoteArtifactContents(params: {
	form: PushBlogParams['form']
	dateStr: string
	coverPath?: string
	readStorageRaw: () => Promise<string | null>
	fallbackReadIndexRaw: () => Promise<string | null>
}): Promise<{ index: string; categories: string; folders: string; storage: string }> {
	const artifacts = await prepareBlogStaticArtifacts({
		readStorageRaw: params.readStorageRaw,
		fallbackReadIndexRaw: params.fallbackReadIndexRaw,
		upsertItem: buildBlogUpsertItem(params.form, params.dateStr, params.coverPath)
	})

	return {
		index: JSON.stringify(artifacts.index, null, 2),
		categories: serializeCategoriesConfig(artifacts.categories),
		folders: JSON.stringify(artifacts.folders, null, 2),
		storage: JSON.stringify(artifacts.db, null, 2)
	}
}

export function assertPublishableBlog(params: Pick<PushBlogParams, 'form' | 'images'>): void {
	const publishSafety = getWritePublishSafetyState({ markdown: params.form.md, images: params.images ?? [] })
	if (publishSafety.shouldBlockPublishForUnresolvedLocalImages) {
		throw new Error(`本地文件图片引用已失效，请重新选择图片并重新插入后再发布。失效引用：${publishSafety.unresolvedLocalImagePlaceholderIds.join(', ')}`)
	}
}

export function assertEditableSlug(params: Pick<PushBlogParams, 'form' | 'mode' | 'originalSlug'>): void {
	if (params.mode === 'edit' && params.originalSlug && params.originalSlug !== params.form.slug) {
		throw new Error('编辑模式下不支持修改 slug，请保持原 slug 不变')
	}
}

export function assertPublishableOutput(params: Pick<PushBlogParams, 'form' | 'images'>): void {
	assertPublishableBlog(params)
}

export function replacePublishLocalImagePlaceholders(markdown: string, replacements: ReadonlyMap<string, string>): string {
	return replaceLocalImagePlaceholders(markdown, replacements)
}

export async function pushBlog(params: PushBlogParams): Promise<void> {
	const { form, cover, images, mode = 'create', originalSlug } = params

	assertPublishableBlog({ form, images })

	if (!form?.slug) throw new Error('需要 slug')
	assertEditableSlug({ form, mode, originalSlug })

	const token = await getAuthToken()

	toast.info('正在获取分支信息...')
	const refData = await getRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `heads/${GITHUB_CONFIG.BRANCH}`)
	const latestCommitSha = refData.sha

	const basePath = `public/blogs/${form.slug}`
	const commitMessage = mode === 'edit' ? `更新文章: ${form.slug}` : `新增文章: ${form.slug}`

	const allLocalImages: Array<{ img: Extract<ImageItem, { type: 'file' }>; id: string }> = []
	for (const img of images || []) {
		if (img.type === 'file') {
			allLocalImages.push({ img, id: img.id })
		}
	}
	if (cover?.type === 'file') {
		allLocalImages.push({ img: cover, id: cover.id })
	}

	toast.info('正在准备文件...')

	const uploadedHashes = new Set<string>()
	let mdToUpload = form.md
	let coverPath: string | undefined
	const treeItems: TreeItem[] = []

	if (allLocalImages.length > 0) {
		toast.info('正在上传图片...')
		const placeholderReplacements = new Map<string, string>()
		for (const { img, id } of allLocalImages) {
			const hash = img.hash || (await hashFileSHA256(img.file))
			const ext = getFileExt(img.file.name)
			const filename = `${hash}${ext}`
			const publicPath = `/blogs/${form.slug}/${filename}`

			if (!uploadedHashes.has(hash)) {
				const path = `${basePath}/${filename}`
				const contentBase64 = await fileToBase64NoPrefix(img.file)
				const blobData = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, contentBase64, 'base64')
				treeItems.push({
					path,
					mode: '100644',
					type: 'blob',
					sha: blobData.sha
				})
				uploadedHashes.add(hash)
			}

			placeholderReplacements.set(id, publicPath)

			if (cover?.type === 'file' && cover.id === id) {
				coverPath = publicPath
			}
		}
		mdToUpload = replacePublishLocalImagePlaceholders(mdToUpload, placeholderReplacements)
	}

	if (cover?.type === 'url') {
		coverPath = cover.url
	}

	toast.info('正在创建文件...')

	assertPublishableOutput({ form: { ...form, md: mdToUpload }, images: [] })

	const mdBlob = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, toBase64Utf8(mdToUpload), 'base64')
	treeItems.push({
		path: `${basePath}/index.md`,
		mode: '100644',
		type: 'blob',
		sha: mdBlob.sha
	})

	const dateStr = form.date || formatDateTimeLocal()
	const config = {
		title: form.title,
		tags: form.tags,
		date: dateStr,
		summary: form.summary,
		cover: coverPath,
		hidden: form.hidden,
		category: form.category,
		folderPath: form.folderPath,
		favorite: form.favorite
	}

	const configBlob = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, toBase64Utf8(JSON.stringify(config, null, 2)), 'base64')
	treeItems.push({
		path: `${basePath}/config.json`,
		mode: '100644',
		type: 'blob',
		sha: configBlob.sha
	})

	const artifactContents = await buildRemoteArtifactContents({
		form,
		dateStr,
		coverPath,
		readStorageRaw: () => readTextFileFromRepo(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, 'public/blogs/storage.json', GITHUB_CONFIG.BRANCH),
		fallbackReadIndexRaw: () => readTextFileFromRepo(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, 'public/blogs/index.json', GITHUB_CONFIG.BRANCH)
	})

	const indexBlob = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, toBase64Utf8(artifactContents.index), 'base64')
	treeItems.push({ path: 'public/blogs/index.json', mode: '100644', type: 'blob', sha: indexBlob.sha })

	const categoriesBlob = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, toBase64Utf8(artifactContents.categories), 'base64')
	treeItems.push({ path: 'public/blogs/categories.json', mode: '100644', type: 'blob', sha: categoriesBlob.sha })

	const foldersBlob = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, toBase64Utf8(artifactContents.folders), 'base64')
	treeItems.push({ path: 'public/blogs/folders.json', mode: '100644', type: 'blob', sha: foldersBlob.sha })

	const storageBlob = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, toBase64Utf8(artifactContents.storage), 'base64')
	treeItems.push({ path: 'public/blogs/storage.json', mode: '100644', type: 'blob', sha: storageBlob.sha })

	toast.info('正在创建文件树...')
	const treeData = await createTree(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, treeItems, latestCommitSha)

	toast.info('正在创建提交...')
	const commitData = await createCommit(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, commitMessage, treeData.sha, [latestCommitSha])

	toast.info('正在更新分支...')
	await updateRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `heads/${GITHUB_CONFIG.BRANCH}`, commitData.sha)

	toast.success('发布成功！')
}
