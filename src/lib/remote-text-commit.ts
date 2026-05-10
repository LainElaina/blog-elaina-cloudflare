import { GITHUB_CONFIG } from '@/consts'
import { assertSafeBlogSlug } from '@/app/write/services/blog-slug'
import { getAuthToken } from '@/lib/auth'
import { createBlob, createCommit, createTree, getRef, throwStaleRemoteWriteConflictError, toBase64Utf8, updateRef, type TreeItem } from '@/lib/github-client'
import { ALLOWED_UPLOAD_IMAGE_EXTENSIONS, assertAllowedImageFile, getImageFileExtension } from '@/lib/image-content-validation'

export type RemoteTextFile = {
	path: string
	content: string
}

export type RemoteBinaryFile = {
	path: string
	file: File
}

type RemoteBase64File = {
	path: string
	contentBase64: string
}

export type RemoteFileCommit = {
	textFiles?: RemoteTextFile[]
	binaryFiles?: RemoteBinaryFile[]
}

const ALLOWED_REMOTE_TEXT_FILE_PATHS = new Set([
	'src/app/about/list.json',
	'src/app/bloggers/list.json',
	'src/app/pictures/list.json',
	'src/app/projects/list.json',
	'src/app/snippets/list.json',
	'src/config/card-styles.json',
	'src/config/color-presets.json',
	'src/config/custom-components.json',
	'public/blogs/index.json',
	'public/blogs/categories.json',
	'public/blogs/folders.json',
	'public/blogs/storage.json',
	'public/share/list.json',
	'public/share/categories.json',
	'public/share/folders.json',
	'public/share/storage.json'
])

const ALLOWED_EXACT_REMOTE_IMAGE_PATHS = new Set(['public/favicon.png', 'public/images/avatar.png'])
const ALLOWED_DIRECT_REMOTE_IMAGE_DIRECTORIES = [
	'public/images/art',
	'public/images/background',
	'public/images/blogger',
	'public/images/custom-components',
	'public/images/pictures',
	'public/images/project',
	'public/images/share',
	'public/images/social-buttons'
]

function normalizeRemoteRepositoryPath(path: string, errorMessage: string): string {
	if (typeof path !== 'string' || !path || path !== path.trim() || path.startsWith('/') || path.includes('\\')) {
		throw new Error(errorMessage)
	}

	const segments = path.split('/')
	if (segments.some(segment => !segment || segment === '.' || segment.includes('..'))) {
		throw new Error(errorMessage)
	}

	return segments.join('/')
}

function isAllowedDirectRemoteImagePath(path: string): boolean {
	return ALLOWED_DIRECT_REMOTE_IMAGE_DIRECTORIES.some(directory => {
		const prefix = `${directory}/`
		if (!path.startsWith(prefix)) return false
		return !path.slice(prefix.length).includes('/')
	})
}

function isAllowedRemoteBlogImagePath(path: string): boolean {
	const segments = path.split('/')
	if (segments.length !== 4 || segments[0] !== 'public' || segments[1] !== 'blogs') {
		return false
	}

	try {
		assertSafeBlogSlug(segments[2])
		return true
	} catch {
		return false
	}
}

export function assertAllowedRemoteTextFilePath(path: string): string {
	const normalizedPath = normalizeRemoteRepositoryPath(path, '不允许远端写入路径')
	if (!ALLOWED_REMOTE_TEXT_FILE_PATHS.has(normalizedPath)) {
		throw new Error('不允许远端写入路径')
	}
	return normalizedPath
}

export function assertAllowedRemoteBinaryFilePath(path: string): string {
	const normalizedPath = normalizeRemoteRepositoryPath(path, '不允许远端图片路径')
	if (!ALLOWED_UPLOAD_IMAGE_EXTENSIONS.has(getImageFileExtension(normalizedPath))) {
		throw new Error('不允许远端图片路径')
	}
	if (ALLOWED_EXACT_REMOTE_IMAGE_PATHS.has(normalizedPath) || isAllowedDirectRemoteImagePath(normalizedPath) || isAllowedRemoteBlogImagePath(normalizedPath)) {
		return normalizedPath
	}
	throw new Error('不允许远端图片路径')
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer)
	const chunkSize = 0x8000
	let binary = ''

	for (let index = 0; index < bytes.length; index += chunkSize) {
		binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
	}

	return btoa(binary)
}

async function commitRemoteBase64Files(files: RemoteBase64File[], message: string): Promise<void> {
	async function attemptCommit(): Promise<void> {
		const token = await getAuthToken()
		const ref = await getRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `heads/${GITHUB_CONFIG.BRANCH}`)
		const treeItems: TreeItem[] = []

		for (const file of files) {
			const blob = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, file.contentBase64, 'base64')
			treeItems.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha })
		}

		const tree = await createTree(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, treeItems, ref.sha)
		const commit = await createCommit(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, message, tree.sha, [ref.sha])
		await updateRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `heads/${GITHUB_CONFIG.BRANCH}`, commit.sha)
	}

	try {
		await attemptCommit()
	} catch (error) {
		throwStaleRemoteWriteConflictError(error)
	}
}

export async function commitRemoteFiles(files: RemoteFileCommit, message: string): Promise<void> {
	const textFiles = files.textFiles ?? []
	const binaryFiles = files.binaryFiles ?? []
	const base64Files: RemoteBase64File[] = textFiles.map(file => ({
		path: assertAllowedRemoteTextFilePath(file.path),
		contentBase64: toBase64Utf8(file.content)
	}))

	for (const file of binaryFiles) {
		const path = assertAllowedRemoteBinaryFilePath(file.path)
		await assertAllowedImageFile(file.file, getImageFileExtension(path))
		base64Files.push({ path, contentBase64: arrayBufferToBase64(await file.file.arrayBuffer()) })
	}

	await commitRemoteBase64Files(base64Files, message)
}

export async function commitRemoteTextFiles(files: RemoteTextFile[], message: string): Promise<void> {
	await commitRemoteFiles({ textFiles: files }, message)
}

export async function commitRemoteBinaryFile(file: RemoteBinaryFile, message: string): Promise<void> {
	await commitRemoteFiles({ binaryFiles: [file] }, message)
}
