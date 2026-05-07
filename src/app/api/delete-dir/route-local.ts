import { lstat, realpath, rm } from 'fs/promises'
import { dirname, relative, resolve } from 'path'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { assertSafeBlogSlug } from '../../write/services/blog-slug.ts'
import { isJsonRequestBodyTooLargeError, readLimitedJsonRequest } from '../limited-json-request.ts'
import { isPathStrictlyInsideDirectory } from '../local-path.ts'

const MAX_DELETE_DIR_REQUEST_BODY_SIZE = 1024 * 1024

function getContentLength(request: NextRequest) {
	const value = request.headers?.get('content-length')
	if (!value) return null
	const length = Number(value)
	return Number.isFinite(length) && length >= 0 ? length : null
}

function isAllowedBlogDirectoryPath(blogDir: string, fullPath: string) {
	if (!isPathStrictlyInsideDirectory(blogDir, fullPath)) {
		return false
	}

	try {
		assertSafeBlogSlug(relative(blogDir, fullPath))
		return true
	} catch {
		return false
	}
}

function isFileNotFoundError(error: unknown) {
	return Boolean(error) && typeof error === 'object' && 'code' in error && error.code === 'ENOENT'
}

function isUnsafeDeleteDirParentError(error: unknown) {
	return error instanceof Error && error.message === 'unsafe-delete-dir-parent'
}

async function assertSafeDeleteDirParent(fullPath: string) {
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
		throw new Error('unsafe-delete-dir-parent')
	}
	if ((await realpath(parentDir)) !== parentDir) {
		throw new Error('unsafe-delete-dir-parent')
	}
}

export async function handleDeleteDir(request: NextRequest) {
	try {
		const contentLength = getContentLength(request)
		if (contentLength !== null && contentLength > MAX_DELETE_DIR_REQUEST_BODY_SIZE) {
			return NextResponse.json({ error: '请求体超过 1MB 限制' }, { status: 413 })
		}

		let body: unknown
		try {
			body = await readLimitedJsonRequest(request, MAX_DELETE_DIR_REQUEST_BODY_SIZE)
		} catch (error) {
			if (isJsonRequestBodyTooLargeError(error)) {
				return NextResponse.json({ error: '请求体超过 1MB 限制' }, { status: 413 })
			}
			return NextResponse.json({ error: '请求体格式错误' }, { status: 400 })
		}

		if (!body || typeof body !== 'object' || Array.isArray(body)) {
			return NextResponse.json({ error: '请求体格式错误' }, { status: 400 })
		}

		const { path: dirPath } = body as Record<string, unknown>

		if (!dirPath || typeof dirPath !== 'string') {
			return NextResponse.json({ error: '缺少目录路径' }, { status: 400 })
		}

		const blogDir = resolve(process.cwd(), 'public/blogs')
		const fullPath = resolve(process.cwd(), dirPath)

		if (!isAllowedBlogDirectoryPath(blogDir, fullPath)) {
			return NextResponse.json({ error: '路径不合法，只能删除 public/blogs 下的文章目录' }, { status: 403 })
		}

		await assertSafeDeleteDirParent(fullPath)

		try {
			const targetStat = await lstat(fullPath)
			if (!targetStat.isDirectory()) {
				return NextResponse.json({ error: '路径不合法，只能删除文章目录' }, { status: 403 })
			}
		} catch (error) {
			if (isFileNotFoundError(error)) {
				return NextResponse.json({ success: true })
			}
			throw error
		}

		await rm(fullPath, { recursive: true, force: true })

		return NextResponse.json({ success: true })
	} catch (error: any) {
		if (isUnsafeDeleteDirParentError(error)) {
			return NextResponse.json({ error: '路径不合法，只能删除 public/blogs 下的文章目录' }, { status: 403 })
		}
		console.error('Delete dir error:', error)
		return NextResponse.json({ error: '删除失败' }, { status: 500 })
	}
}
