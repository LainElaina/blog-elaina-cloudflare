import {
	toBase64Utf8,
	getRef,
	createTree,
	createCommit,
	updateRef,
	createBlob,
	type TreeItem,
	readTextFileFromRepo,
	listRepoFilesRecursive,
	isGitHubUpdateRefConflictError
} from '@/lib/github-client'
import { fileToBase64NoPrefix, hashFileSHA256 } from '@/lib/file-utils'
import { ALLOWED_IMAGE_EXTENSIONS, isAllowedImageContent } from '@/lib/image-content-validation'
import { parseBlogStorageDB } from '@/lib/content-db/blog-storage'
import { prepareBlogStaticArtifacts, serializeCategoriesConfig, type BlogIndexItem } from '@/lib/blog-index'
import { getAuthToken } from '@/lib/auth'
import { GITHUB_CONFIG } from '@/consts'
import type { ImageItem } from '../types'
import { toast } from 'sonner'
import { buildPublishedWriteSnapshot, formatDateTimeLocal, getWritePublishSafetyState, replaceLocalImagePlaceholders, type WriteSafetySnapshot } from '../write-safety'
import { assertSafeBlogSlug } from './blog-slug'

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
	assertSafeBlogSlug(params.form.slug)
	if (params.originalSlug) {
		assertSafeBlogSlug(params.originalSlug)
	}
	if (params.mode === 'edit' && params.originalSlug && params.originalSlug !== params.form.slug) {
		throw new Error('编辑模式下不支持修改 slug，请保持原 slug 不变')
	}
}

export function hasExistingBlogSlug(params: { slug: string; storageRaw: string | null; indexRaw: string | null }): boolean {
	assertSafeBlogSlug(params.slug)
	const storage = parseBlogStorageDB(params.storageRaw)
	if (storage.blogs[params.slug]) {
		return true
	}
	if (!params.indexRaw) {
		return false
	}
	try {
		const index = JSON.parse(params.indexRaw)
		return Array.isArray(index) && index.some(item => item?.slug === params.slug)
	} catch {
		return false
	}
}

export function assertCreateBlogSlugAvailable(params: { slug: string; storageRaw: string | null; indexRaw: string | null; hasExistingFiles?: boolean }): void {
	assertSafeBlogSlug(params.slug)
	if (params.hasExistingFiles === true || hasExistingBlogSlug(params)) {
		throw new Error('slug 已存在，请更换 slug 或进入编辑模式')
	}
}

function getPublishImageFileExtension(filename: string): string {
	const dotIndex = filename.lastIndexOf('.')
	return dotIndex >= 0 ? filename.slice(dotIndex).toLowerCase() : ''
}

export async function assertAllowedPublishImageFile(file: File, extension: string): Promise<void> {
	if (!ALLOWED_IMAGE_EXTENSIONS.has(extension)) {
		throw new Error(`不允许的图片文件类型: ${extension}`)
	}
	if (file.size === 0) {
		throw new Error('图片文件不能为空')
	}
	const buffer = new Uint8Array(await file.arrayBuffer())
	if (buffer.length === 0) {
		throw new Error('图片文件不能为空')
	}
	if (!isAllowedImageContent(extension, buffer)) {
		throw new Error('图片内容与文件类型不匹配')
	}
}

export function assertPublishableOutput(params: Pick<PushBlogParams, 'form' | 'images'>): void {
	assertPublishableBlog(params)
}

const BLOG_IMAGE_FILE_EXTENSION_PATTERN = /\.(?:avif|gif|ico|jpe?g|png|svg|webp)$/i

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isSafeBlogImageFilename(filename: string): boolean {
	return (
		Boolean(filename) && !filename.includes('/') && !filename.includes('\\') && !filename.includes('..') && BLOG_IMAGE_FILE_EXTENSION_PATTERN.test(filename)
	)
}

function blogImageRepoPath(slug: string, publicPath: string): string | null {
	const publicPrefix = `/blogs/${slug}/`
	if (!publicPath.startsWith(publicPrefix)) {
		return null
	}
	const pathOnly = publicPath.split(/[?#]/, 1)[0]
	const filename = pathOnly.slice(publicPrefix.length)
	if (!isSafeBlogImageFilename(filename)) {
		return null
	}
	return `public/blogs/${slug}/${filename}`
}

export function collectBlogImageRepoPaths(params: { slug: string; markdown: string; coverPath?: string }): Set<string> {
	const paths = new Set<string>()
	const addPublicPath = (publicPath?: string) => {
		if (!publicPath) return
		const path = blogImageRepoPath(params.slug, publicPath)
		if (path) paths.add(path)
	}
	const publicPrefix = `/blogs/${params.slug}/`
	const publicPathPattern = new RegExp(`${escapeRegExp(publicPrefix)}[^\\s\\)\\]"'<>]+`, 'g')
	for (const match of params.markdown.matchAll(publicPathPattern)) {
		addPublicPath(match[0])
	}
	addPublicPath(params.coverPath)
	return paths
}

export function buildUnusedBlogImageDeleteTreeItems(params: {
	slug: string
	existingRepoFiles: string[]
	markdown: string
	coverPath?: string
	protectedRepoPaths?: ReadonlySet<string>
}): TreeItem[] {
	assertSafeBlogSlug(params.slug)
	const repoPrefix = `public/blogs/${params.slug}/`
	const currentPaths = collectBlogImageRepoPaths(params)
	const treeItems: TreeItem[] = []

	for (const path of params.existingRepoFiles) {
		if (!path.startsWith(repoPrefix)) continue
		const filename = path.slice(repoPrefix.length)
		if (!isSafeBlogImageFilename(filename) || currentPaths.has(path) || params.protectedRepoPaths?.has(path)) continue
		treeItems.push({
			path,
			mode: '100644',
			type: 'blob',
			sha: null
		})
	}

	return treeItems
}

export function replacePublishLocalImagePlaceholders(markdown: string, replacements: ReadonlyMap<string, string>): string {
	return replaceLocalImagePlaceholders(markdown, replacements)
}

export async function pushBlog(params: PushBlogParams): Promise<WriteSafetySnapshot> {
	const { form, cover, images, mode = 'create', originalSlug } = params

	assertPublishableBlog({ form, images })

	if (!form?.slug) throw new Error('需要 slug')
	assertEditableSlug({ form, mode, originalSlug })

	async function attemptPushBlog(): Promise<WriteSafetySnapshot> {
		const token = await getAuthToken()

		toast.info('正在获取分支信息...')
		const refData = await getRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `heads/${GITHUB_CONFIG.BRANCH}`)
		const latestCommitSha = refData.sha

		const basePath = `public/blogs/${form.slug}`
		const commitMessage = mode === 'edit' ? `更新文章: ${form.slug}` : `新增文章: ${form.slug}`
		const storageRaw = await readTextFileFromRepo(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, 'public/blogs/storage.json', latestCommitSha)
		const indexRaw = await readTextFileFromRepo(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, 'public/blogs/index.json', latestCommitSha)
		if (mode === 'create') {
			const existingFiles = await listRepoFilesRecursive(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, basePath, latestCommitSha)
			assertCreateBlogSlugAvailable({
				slug: form.slug,
				storageRaw,
				indexRaw,
				hasExistingFiles: existingFiles.length > 0
			})
		}

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

		const uploadedImagePaths = new Map<string, string>()
		const plannedImageUploads = new Map<string, { path: string; img: Extract<ImageItem, { type: 'file' }> }>()
		const imagePaths = new Map<string, string>()
		let mdToUpload = form.md
		let coverPath: string | undefined
		const treeItems: TreeItem[] = []

		if (allLocalImages.length > 0) {
			const placeholderReplacements = new Map<string, string>()
			for (const { img, id } of allLocalImages) {
				const ext = getPublishImageFileExtension(img.file.name)
				await assertAllowedPublishImageFile(img.file, ext)
				const hash = img.hash || (await hashFileSHA256(img.file))
				const filename = `${hash}${ext}`
				const publicPath = `/blogs/${form.slug}/${filename}`
				const uploadKey = filename

				if (!uploadedImagePaths.has(uploadKey)) {
					uploadedImagePaths.set(uploadKey, publicPath)
					plannedImageUploads.set(uploadKey, { path: `${basePath}/${filename}`, img })
				}

				const uploadedPath = uploadedImagePaths.get(uploadKey)!
				placeholderReplacements.set(id, uploadedPath)
				imagePaths.set(id, uploadedPath)

				if (cover?.type === 'file' && cover.id === id) {
					coverPath = uploadedPath
				}
			}
			mdToUpload = replacePublishLocalImagePlaceholders(mdToUpload, placeholderReplacements)
		}

		if (cover?.type === 'url') {
			coverPath = cover.url
		}

		assertPublishableOutput({ form: { ...form, md: mdToUpload }, images: [] })

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

		const artifactContents = await buildRemoteArtifactContents({
			form,
			dateStr,
			coverPath,
			readStorageRaw: async () => storageRaw,
			fallbackReadIndexRaw: async () => indexRaw
		})

		if (plannedImageUploads.size > 0) {
			toast.info('正在上传图片...')
			for (const { path, img } of plannedImageUploads.values()) {
				const contentBase64 = await fileToBase64NoPrefix(img.file)
				const blobData = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, contentBase64, 'base64')
				treeItems.push({
					path,
					mode: '100644',
					type: 'blob',
					sha: blobData.sha
				})
			}
		}

		toast.info('正在创建文件...')

		const mdBlob = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, toBase64Utf8(mdToUpload), 'base64')
		treeItems.push({
			path: `${basePath}/index.md`,
			mode: '100644',
			type: 'blob',
			sha: mdBlob.sha
		})

		const configBlob = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, toBase64Utf8(JSON.stringify(config, null, 2)), 'base64')
		treeItems.push({
			path: `${basePath}/config.json`,
			mode: '100644',
			type: 'blob',
			sha: configBlob.sha
		})

		const indexBlob = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, toBase64Utf8(artifactContents.index), 'base64')
		treeItems.push({ path: 'public/blogs/index.json', mode: '100644', type: 'blob', sha: indexBlob.sha })

		const categoriesBlob = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, toBase64Utf8(artifactContents.categories), 'base64')
		treeItems.push({ path: 'public/blogs/categories.json', mode: '100644', type: 'blob', sha: categoriesBlob.sha })

		const foldersBlob = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, toBase64Utf8(artifactContents.folders), 'base64')
		treeItems.push({ path: 'public/blogs/folders.json', mode: '100644', type: 'blob', sha: foldersBlob.sha })

		const storageBlob = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, toBase64Utf8(artifactContents.storage), 'base64')
		treeItems.push({ path: 'public/blogs/storage.json', mode: '100644', type: 'blob', sha: storageBlob.sha })

		if (mode === 'edit') {
			const existingRepoFiles = await listRepoFilesRecursive(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, basePath, latestCommitSha)
			treeItems.push(
				...buildUnusedBlogImageDeleteTreeItems({
					slug: form.slug,
					existingRepoFiles,
					markdown: mdToUpload,
					coverPath,
					protectedRepoPaths: new Set(treeItems.map(item => item.path))
				})
			)
		}

		toast.info('正在创建文件树...')
		const treeData = await createTree(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, treeItems, latestCommitSha)

		toast.info('正在创建提交...')
		const commitData = await createCommit(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, commitMessage, treeData.sha, [latestCommitSha])

		toast.info('正在更新分支...')
		await updateRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `heads/${GITHUB_CONFIG.BRANCH}`, commitData.sha)

		return buildPublishedWriteSnapshot({
			form,
			cover,
			images,
			mode,
			originalSlug,
			markdown: mdToUpload,
			dateStr,
			coverPath,
			imagePaths
		})
	}

	try {
		return await attemptPushBlog()
	} catch (error) {
		if (isGitHubUpdateRefConflictError(error)) {
			toast.info('分支已更新，正在重新发布...')
			return attemptPushBlog()
		}
		throw error
	}
}
