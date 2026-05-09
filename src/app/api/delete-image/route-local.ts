import { lstat, realpath, unlink } from 'fs/promises'
import { dirname, extname, resolve } from 'path'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { ALLOWED_IMAGE_EXTENSIONS } from '../../../lib/image-content-validation.ts'
import { isJsonRequestBodyTooLargeError, readLimitedJsonRequest } from '../limited-json-request.ts'
import { withLocalContentMutationLock } from '../local-content-mutation-lock.ts'
import { getLocalUploadImageMutationScope, isAllowedLocalUploadImagePath } from '../local-upload-image-path.ts'

const MAX_DELETE_IMAGE_REQUEST_BODY_SIZE = 1024 * 1024

export { isAllowedLocalUploadImagePath as isAllowedDeleteImagePath } from '../local-upload-image-path.ts'

function isFileNotFoundError(error: unknown) {
	return (error as NodeJS.ErrnoException)?.code === 'ENOENT'
}

function isUnsafeDeleteImageDirectoryError(error: unknown) {
	return error instanceof Error && error.message === 'unsafe-image-directory'
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

		if (!isAllowedLocalUploadImagePath(projectDir, fullPath)) {
			return NextResponse.json({ error: '路径不合法，只能删除本地上传目录内的图片文件' }, { status: 403 })
		}

		const deleteImage = async () => {
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
		}

		const mutationScope = getLocalUploadImageMutationScope(projectDir, fullPath)
		if (mutationScope) {
			return await withLocalContentMutationLock(projectDir, mutationScope, deleteImage)
		}
		return await deleteImage()
	} catch (error: any) {
		if (isUnsafeDeleteImageDirectoryError(error)) {
			return NextResponse.json({ error: '路径不合法，只能删除本地上传目录内的图片文件' }, { status: 403 })
		}
		console.error('Delete error:', error)
		return NextResponse.json({ error: '删除失败' }, { status: 500 })
	}
}
