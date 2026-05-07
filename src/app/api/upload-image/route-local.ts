import { mkdir, realpath, rename, rm, writeFile } from 'fs/promises'
import { dirname, extname, relative, resolve } from 'path'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { ALLOWED_IMAGE_EXTENSIONS, isAllowedImageContent } from '../../../lib/image-content-validation.ts'
import { assertSafeBlogSlug } from '../../write/services/blog-slug.ts'
import { isPathInsideDirectory, isPathStrictlyInsideDirectory } from '../local-path.ts'

export { isAllowedImageContent }
const ALLOWED_EXACT_UPLOAD_IMAGE_PATHS = ['public/favicon.png', 'public/images/avatar.png']
const ALLOWED_DIRECT_UPLOAD_IMAGE_DIRECTORIES = [
	'public/images/art',
	'public/images/background',
	'public/images/blogger',
	'public/images/custom-components',
	'public/images/pictures',
	'public/images/project',
	'public/images/share',
	'public/images/social-buttons'
]
const MAX_FILE_SIZE = 10 * 1024 * 1024
const MAX_REQUEST_BODY_SIZE = MAX_FILE_SIZE + 1024 * 1024

function getContentLength(request: NextRequest) {
	const value = request.headers?.get('content-length')
	if (!value) return null
	const length = Number(value)
	return Number.isFinite(length) && length >= 0 ? length : null
}

function isSafeUploadedImageFilename(filename: string) {
	return Boolean(filename) && !filename.includes('/') && !filename.includes('\\') && !filename.includes('..')
}

async function findExistingAncestorDirectory(dir: string): Promise<string> {
	try {
		await realpath(dir)
		return dir
	} catch (error: any) {
		if (error?.code !== 'ENOENT') {
			throw error
		}
	}

	const parentDir = dirname(dir)
	if (parentDir === dir) {
		return dir
	}
	return findExistingAncestorDirectory(parentDir)
}

async function assertSafeExistingParentDirectory(projectDir: string, dir: string) {
	const existingDir = await findExistingAncestorDirectory(dir)
	const realParentDir = await realpath(existingDir)
	if (!isPathInsideDirectory(projectDir, realParentDir) || realParentDir !== resolve(existingDir)) {
		throw new Error('unsafe-parent-directory')
	}
}

function isUnsafeParentDirectoryError(error: unknown) {
	return error instanceof Error && error.message === 'unsafe-parent-directory'
}

function isDirectChildFilePath(baseDir: string, fullPath: string) {
	if (!isPathStrictlyInsideDirectory(baseDir, fullPath)) {
		return false
	}

	return isSafeUploadedImageFilename(relative(baseDir, fullPath))
}

function isAllowedBlogUploadImagePath(projectDir: string, fullPath: string) {
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

class MultipartRequestBodyTooLargeError extends Error {
	constructor() {
		super('Multipart request body is too large')
		this.name = 'MultipartRequestBodyTooLargeError'
	}
}

function isMultipartRequestBodyTooLargeError(error: unknown) {
	return error instanceof MultipartRequestBodyTooLargeError
}

async function buildLimitedMultipartRequest(request: NextRequest, maxBytes: number): Promise<Request | NextRequest> {
	if (!('body' in request) || !request.body) {
		return request
	}

	const reader = request.body.getReader()
	const chunks: Uint8Array[] = []
	let totalBytes = 0

	while (true) {
		const { done, value } = await reader.read()
		if (done) {
			break
		}
		if (!value) {
			continue
		}
		totalBytes += value.byteLength
		if (totalBytes > maxBytes) {
			await reader.cancel().catch(() => undefined)
			throw new MultipartRequestBodyTooLargeError()
		}
		chunks.push(value)
	}

	return new Request(request.url, {
		method: request.method,
		headers: request.headers,
		body: new Blob(chunks)
	})
}

export function isAllowedUploadImagePath(projectDir: string, fullPath: string) {
	return (
		ALLOWED_EXACT_UPLOAD_IMAGE_PATHS.some(allowedPath => resolve(projectDir, allowedPath) === fullPath) ||
		ALLOWED_DIRECT_UPLOAD_IMAGE_DIRECTORIES.some(allowedDir => isDirectChildFilePath(resolve(projectDir, allowedDir), fullPath)) ||
		isAllowedBlogUploadImagePath(projectDir, fullPath)
	)
}

function buildAtomicUploadTempPath(fullPath: string) {
	return `${fullPath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

async function writeImageAtomically(fullPath: string, buffer: Buffer) {
	const tempPath = buildAtomicUploadTempPath(fullPath)
	try {
		await writeFile(tempPath, buffer)
		await rename(tempPath, fullPath)
	} catch (error) {
		await rm(tempPath, { force: true }).catch(() => undefined)
		throw error
	}
}

export async function handleUploadImage(request: NextRequest) {
	try {
		const contentLength = getContentLength(request)
		if (contentLength !== null && contentLength > MAX_REQUEST_BODY_SIZE) {
			return NextResponse.json({ error: '文件大小超过 10MB 限制' }, { status: 413 })
		}

		let formData: FormData
		try {
			const limitedRequest = await buildLimitedMultipartRequest(request, MAX_REQUEST_BODY_SIZE)
			formData = await limitedRequest.formData()
		} catch (error) {
			if (isMultipartRequestBodyTooLargeError(error)) {
				return NextResponse.json({ error: '文件大小超过 10MB 限制' }, { status: 413 })
			}
			return NextResponse.json({ error: '请求体格式错误' }, { status: 400 })
		}

		const file = formData.get('file')
		const path = formData.get('path')

		if (!(file instanceof File) || typeof path !== 'string' || path.length === 0) {
			return NextResponse.json({ error: 'Missing file or path' }, { status: 400 })
		}

		if (file.size === 0) {
			return NextResponse.json({ error: '上传文件不能为空' }, { status: 400 })
		}

		if (file.size > MAX_FILE_SIZE) {
			return NextResponse.json({ error: '文件大小超过 10MB 限制' }, { status: 413 })
		}

		const ext = extname(path).toLowerCase()
		if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
			return NextResponse.json({ error: `不允许的文件类型: ${ext}` }, { status: 400 })
		}

		const projectDir = resolve(process.cwd())
		const publicDir = resolve(projectDir, 'public')
		const fullPath = resolve(projectDir, path)

		if (!isPathInsideDirectory(publicDir, fullPath)) {
			return NextResponse.json({ error: `路径不合法，只能写入 public 目录` }, { status: 403 })
		}

		if (!isAllowedUploadImagePath(projectDir, fullPath)) {
			return NextResponse.json({ error: '路径不合法，只能上传到本地上传目录内的图片文件' }, { status: 403 })
		}

		const bytes = await file.arrayBuffer()
		const buffer = Buffer.from(bytes)
		if (buffer.length === 0) {
			return NextResponse.json({ error: '上传文件不能为空' }, { status: 400 })
		}
		if (!isAllowedImageContent(ext, buffer)) {
			return NextResponse.json({ error: '图片内容与文件类型不匹配' }, { status: 400 })
		}

		const dir = dirname(fullPath)
		await assertSafeExistingParentDirectory(projectDir, dir)
		await mkdir(dir, { recursive: true })

		await writeImageAtomically(fullPath, buffer)

		return NextResponse.json({ success: true, path })
	} catch (error: any) {
		if (isUnsafeParentDirectoryError(error)) {
			return NextResponse.json({ error: '路径不合法' }, { status: 403 })
		}
		console.error('Upload error:', error)
		return NextResponse.json({ error: '上传失败' }, { status: 500 })
	}
}
