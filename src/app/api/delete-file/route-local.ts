import { lstat, unlink } from 'fs/promises'
import { resolve } from 'path'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { isJsonRequestBodyTooLargeError, readLimitedJsonRequest } from '../limited-json-request.ts'
import { isAllowedSaveFilePath } from '../save-file/local-save-file-path.ts'

const MAX_DELETE_FILE_REQUEST_BODY_SIZE = 1024 * 1024

function getContentLength(request: NextRequest) {
	const value = request.headers?.get('content-length')
	if (!value) return null
	const length = Number(value)
	return Number.isFinite(length) && length >= 0 ? length : null
}

export async function handleDeleteFile(request: NextRequest) {
	try {
		const contentLength = getContentLength(request)
		if (contentLength !== null && contentLength > MAX_DELETE_FILE_REQUEST_BODY_SIZE) {
			return NextResponse.json({ error: '请求体超过 1MB 限制' }, { status: 413 })
		}

		let body: unknown
		try {
			body = await readLimitedJsonRequest(request, MAX_DELETE_FILE_REQUEST_BODY_SIZE)
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

		const projectDir = resolve(process.cwd())
		const fullPath = resolve(process.cwd(), filePath)

		if (!isAllowedSaveFilePath(projectDir, fullPath)) {
			return NextResponse.json({ error: '路径不合法' }, { status: 403 })
		}

		const fileStats = await lstat(fullPath).catch(error => {
			if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
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
			if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
				throw error
			}
		})
		return NextResponse.json({ success: true })
	} catch (error: any) {
		console.error('Delete file error:', error)
		return NextResponse.json({ error: '删除失败' }, { status: 500 })
	}
}
