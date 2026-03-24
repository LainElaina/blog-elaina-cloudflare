import { NextRequest, NextResponse } from 'next/server'
import { unlink } from 'fs/promises'
import { resolve } from 'path'
import { existsSync } from 'fs'

export async function POST(request: NextRequest) {
	if (process.env.NODE_ENV !== 'development') {
		return NextResponse.json({ error: '此接口仅在本地开发环境可用' }, { status: 403 })
	}

	try {
		const { path: filePath } = await request.json()

		if (!filePath || typeof filePath !== 'string') {
			return NextResponse.json({ error: '缺少文件路径' }, { status: 400 })
		}

		// 路径安全校验：必须在 public 目录内
		const publicDir = resolve(process.cwd(), 'public').replace(/\\/g, '/')
		const fullPath = resolve(process.cwd(), filePath).replace(/\\/g, '/')

		if (!fullPath.startsWith(publicDir)) {
			return NextResponse.json({ error: '路径不合法，只能删除 public 目录内的文件' }, { status: 403 })
		}

		if (!existsSync(fullPath)) {
			return NextResponse.json({ success: true, message: '文件不存在，无需删除' })
		}

		await unlink(fullPath)
		return NextResponse.json({ success: true })
	} catch (error: any) {
		console.error('Delete error:', error)
		return NextResponse.json({ error: '删除失败' }, { status: 500 })
	}
}
