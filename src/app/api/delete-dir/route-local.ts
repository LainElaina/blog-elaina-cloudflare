import { rm } from 'fs/promises'
import { resolve } from 'path'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { isPathStrictlyInsideDirectory } from '../local-path'

export async function handleDeleteDir(request: NextRequest) {
	try {
		const { path: dirPath } = await request.json()

		if (!dirPath || typeof dirPath !== 'string') {
			return NextResponse.json({ error: '缺少目录路径' }, { status: 400 })
		}

		const blogDir = resolve(process.cwd(), 'public/blogs')
		const fullPath = resolve(process.cwd(), dirPath)

		if (!isPathStrictlyInsideDirectory(blogDir, fullPath)) {
			return NextResponse.json({ error: '路径不合法，只能删除 public/blogs 目录内的子目录' }, { status: 403 })
		}

		await rm(fullPath, { recursive: true, force: true })

		return NextResponse.json({ success: true })
	} catch (error: any) {
		console.error('Delete dir error:', error)
		return NextResponse.json({ error: '删除失败' }, { status: 500 })
	}
}
