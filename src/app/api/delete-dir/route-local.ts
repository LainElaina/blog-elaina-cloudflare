import { rm, stat } from 'fs/promises'
import { relative, resolve } from 'path'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { assertSafeBlogSlug } from '../../write/services/blog-slug'
import { isPathStrictlyInsideDirectory } from '../local-path'

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

export async function handleDeleteDir(request: NextRequest) {
	try {
		let body: unknown
		try {
			body = await request.json()
		} catch {
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

		try {
			const targetStat = await stat(fullPath)
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
		console.error('Delete dir error:', error)
		return NextResponse.json({ error: '删除失败' }, { status: 500 })
	}
}
