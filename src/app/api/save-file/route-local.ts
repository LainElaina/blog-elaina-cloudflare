import { existsSync } from 'fs'
import { mkdir, writeFile } from 'fs/promises'
import { dirname, resolve } from 'path'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export async function handleSaveFile(request: NextRequest) {
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
