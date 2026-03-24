import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { resolve, dirname } from 'path'
import { existsSync } from 'fs'

export async function POST(request: NextRequest) {
	if (process.env.NODE_ENV !== 'development') {
		return NextResponse.json({ error: '此接口仅在本地开发环境可用' }, { status: 403 })
	}

	try {
		const { path: filePath, content } = await request.json()

		if (!filePath || typeof filePath !== 'string' || typeof content !== 'string') {
			return NextResponse.json({ error: '缺少文件路径或内容' }, { status: 400 })
		}

		const projectDir = resolve(process.cwd()).replace(/\\/g, '/')
		const fullPath = resolve(process.cwd(), filePath).replace(/\\/g, '/')

		if (!fullPath.startsWith(projectDir)) {
			return NextResponse.json({ error: '路径不合法' }, { status: 403 })
		}

		const dir = dirname(fullPath)
		if (!existsSync(dir)) {
			await mkdir(dir, { recursive: true })
		}

		await writeFile(fullPath, content, 'utf-8')
		return NextResponse.json({ success: true })
	} catch (error: any) {
		console.error('Save file error:', error)
		return NextResponse.json({ error: '保存失败' }, { status: 500 })
	}
}
