import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join, resolve, extname } from 'path'
import { existsSync } from 'fs'

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico', '.avif'])
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(request: NextRequest) {
	// 仅限本地开发环境
	if (process.env.NODE_ENV !== 'development') {
		return NextResponse.json({ error: '此接口仅在本地开发环境可用' }, { status: 403 })
	}

	try {
		const formData = await request.formData()
		const file = formData.get('file') as File
		const path = formData.get('path') as string

		if (!file || !path) {
			return NextResponse.json({ error: 'Missing file or path' }, { status: 400 })
		}

		// 文件大小限制
		if (file.size > MAX_FILE_SIZE) {
			return NextResponse.json({ error: '文件大小超过 10MB 限制' }, { status: 400 })
		}

		// 文件类型白名单
		const ext = extname(path).toLowerCase()
		if (!ALLOWED_EXTENSIONS.has(ext)) {
			return NextResponse.json({ error: `不允许的文件类型: ${ext}` }, { status: 400 })
		}

		// 路径穿越防护：解析后必须在 public 目录内
		const publicDir = resolve(process.cwd(), 'public').replace(/\\/g, '/')
		const fullPath = resolve(process.cwd(), path).replace(/\\/g, '/')

		if (!fullPath.startsWith(publicDir)) {
			return NextResponse.json({ error: `路径不合法，只能写入 public 目录` }, { status: 403 })
		}

		const bytes = await file.arrayBuffer()
		const buffer = Buffer.from(bytes)

		const dir = fullPath.substring(0, fullPath.lastIndexOf('/'))
		if (!existsSync(dir)) {
			await mkdir(dir, { recursive: true })
		}

		await writeFile(fullPath, buffer)

		return NextResponse.json({ success: true, path })
	} catch (error: any) {
		console.error('Upload error:', error)
		return NextResponse.json({ error: '上传失败' }, { status: 500 })
	}
}
