import { NextRequest, NextResponse } from 'next/server'
import { rm } from 'fs/promises'
import { resolve } from 'path'
import { existsSync } from 'fs'

export async function POST(request: NextRequest) {
	if (process.env.NODE_ENV !== 'development') {
		return NextResponse.json({ error: '此接口仅在本地开发环境可用' }, { status: 403 })
	}

	try {
		const { path: dirPath } = await request.json()

		if (!dirPath || typeof dirPath !== 'string') {
			return NextResponse.json({ error: '缺少目录路径' }, { status: 400 })
		}

		const publicDir = resolve(process.cwd(), 'public').replace(/\\/g, '/')
		const fullPath = resolve(process.cwd(), dirPath).replace(/\\/g, '/')

		if (!fullPath.startsWith(publicDir)) {
			return NextResponse.json({ error: '路径不合法，只能删除 public 目录内的内容' }, { status: 403 })
		}

		if (existsSync(fullPath)) {
			await rm(fullPath, { recursive: true })
		}

		return NextResponse.json({ success: true })
	} catch (error: any) {
		console.error('Delete dir error:', error)
		return NextResponse.json({ error: '删除失败' }, { status: 500 })
	}
}
