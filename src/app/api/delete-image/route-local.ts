import { unlink } from 'fs/promises'
import { extname, resolve } from 'path'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { isPathInsideDirectory } from '../local-path'

const ALLOWED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico', '.avif'])

export async function handleDeleteImage(request: NextRequest) {
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

		const { path: filePath } = body as Record<string, unknown>

		if (!filePath || typeof filePath !== 'string') {
			return NextResponse.json({ error: '缺少文件路径' }, { status: 400 })
		}

		const ext = extname(filePath).toLowerCase()
		if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
			return NextResponse.json({ error: `不允许的文件类型: ${ext}` }, { status: 400 })
		}

		const publicDir = resolve(process.cwd(), 'public')
		const fullPath = resolve(process.cwd(), filePath)

		if (!isPathInsideDirectory(publicDir, fullPath)) {
			return NextResponse.json({ error: '路径不合法，只能删除 public 目录内的图片文件' }, { status: 403 })
		}

		await unlink(fullPath).catch(error => {
			if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
				throw error
			}
		})
		return NextResponse.json({ success: true })
	} catch (error: any) {
		console.error('Delete error:', error)
		return NextResponse.json({ error: '删除失败' }, { status: 500 })
	}
}
