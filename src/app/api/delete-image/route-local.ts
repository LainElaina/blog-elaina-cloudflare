import { lstat, realpath, unlink } from 'fs/promises'
import { dirname, extname, relative, resolve } from 'path'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { assertSafeBlogSlug } from '../../write/services/blog-slug.ts'
import { isJsonRequestBodyTooLargeError, readLimitedJsonRequest } from '../limited-json-request.ts'
import { isPathStrictlyInsideDirectory } from '../local-path.ts'

const MAX_DELETE_IMAGE_REQUEST_BODY_SIZE = 1024 * 1024
const ALLOWED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico', '.avif'])
const ALLOWED_EXACT_IMAGE_PATHS = ['public/favicon.png', 'public/images/avatar.png']
const ALLOWED_DIRECT_IMAGE_DIRECTORIES = [
	'public/images/art',
	'public/images/background',
	'public/images/blogger',
	'public/images/custom-components',
	'public/images/pictures',
	'public/images/project',
	'public/images/share',
	'public/images/social-buttons'
]

function getContentLength(request: NextRequest) {
	const value = request.headers?.get('content-length')
	if (!value) return null
	const length = Number(value)
	return Number.isFinite(length) && length >= 0 ? length : null
}

function isFileNotFoundError(error: unknown) {
	return (error as NodeJS.ErrnoException)?.code === 'ENOENT'
}

function isSafeUploadedImageFilename(filename: string) {
	return Boolean(filename) && !filename.includes('/') && !filename.includes('\\') && !filename.includes('..')
}

function isDirectChildFilePath(baseDir: string, fullPath: string) {
	if (!isPathStrictlyInsideDirectory(baseDir, fullPath)) {
		return false
	}

	return isSafeUploadedImageFilename(relative(baseDir, fullPath))
}

function isAllowedBlogImagePath(projectDir: string, fullPath: string) {
	const blogsDir = resolve(projectDir, 'public/blogs')
	if (!isPathStrictlyInsideDirectory(blogsDir, fullPath)) {
		return false
	}

	const relativePath = relative(blogsDir, fullPath).replace(/\\/g, '/')
	const parts = relativePath.split('/')
	if (parts.length !== 2 || !isSafeUploadedImageFilename(parts[1])) {
		return false
	}

	try {
		assertSafeBlogSlug(parts[0])
		return true
	} catch {
		return false
	}
}

export function isAllowedDeleteImagePath(projectDir: string, fullPath: string) {
	return (
		ALLOWED_EXACT_IMAGE_PATHS.some(allowedPath => resolve(projectDir, allowedPath) === fullPath) ||
		ALLOWED_DIRECT_IMAGE_DIRECTORIES.some(allowedDir => isDirectChildFilePath(resolve(projectDir, allowedDir), fullPath)) ||
		isAllowedBlogImagePath(projectDir, fullPath)
	)
}

async function assertSafeDeleteImageDirectory(fullPath: string) {
	const parentDir = dirname(fullPath)
	const parentStats = await lstat(parentDir).catch(error => {
		if (isFileNotFoundError(error)) {
			return null
		}
		throw error
	})
	if (parentStats === null) {
		return
	}
	if (!parentStats.isDirectory()) {
		throw new Error('unsafe-image-directory')
	}
	if ((await realpath(parentDir)) !== parentDir) {
		throw new Error('unsafe-image-directory')
	}
}

export async function handleDeleteImage(request: NextRequest) {
	try {
		const contentLength = getContentLength(request)
		if (contentLength !== null && contentLength > MAX_DELETE_IMAGE_REQUEST_BODY_SIZE) {
			return NextResponse.json({ error: '请求体超过 1MB 限制' }, { status: 413 })
		}

		let body: unknown
		try {
			body = await readLimitedJsonRequest(request, MAX_DELETE_IMAGE_REQUEST_BODY_SIZE)
		} catch (error) {
			if (isJsonRequestBodyTooLargeError(error)) {
				return NextResponse.json({ error: '请求体超过 1MB 限制' }, { status: 413 })
			}
			return NextResponse.json({ error: '请求体格式错误' }, { status: 400 })
		}

		if (!body || typeof body !== 'object' || Array.isArray(body)) {
			return NextResponse.json({ error: '请求体格式错误' }, { status: 400 })
		}

		const { path: filePath } = body as Record<string, unknown>

		if (!filePath || typeof filePath !== 'string') {
			return NextResponse.json({ error: '缺少文件路径' }, { status: 400 })
		}

		const ext = extname(filePath).toLowerCase()
		if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
			return NextResponse.json({ error: `不允许的文件类型: ${ext}` }, { status: 400 })
		}

		const projectDir = resolve(process.cwd())
		const fullPath = resolve(process.cwd(), filePath)

		if (!isAllowedDeleteImagePath(projectDir, fullPath)) {
			return NextResponse.json({ error: '路径不合法，只能删除本地上传目录内的图片文件' }, { status: 403 })
		}

		await assertSafeDeleteImageDirectory(fullPath)
		const fileStats = await lstat(fullPath).catch(error => {
			if (isFileNotFoundError(error)) {
				return null
			}
			throw error
		})

		if (fileStats === null) {
			return NextResponse.json({ success: true })
		}

		if (!fileStats.isFile()) {
			return NextResponse.json({ error: '只能删除普通文件' }, { status: 400 })
		}

		await unlink(fullPath).catch(error => {
			if (!isFileNotFoundError(error)) {
				throw error
			}
		})
		return NextResponse.json({ success: true })
	} catch (error: any) {
		console.error('Delete error:', error)
		return NextResponse.json({ error: '删除失败' }, { status: 500 })
	}
}
