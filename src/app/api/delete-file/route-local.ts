import { lstat, unlink } from 'fs/promises'
import { resolve } from 'path'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { isAllowedSaveFilePath } from '../save-file/local-save-file-path.ts'

export async function handleDeleteFile(request: NextRequest) {
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
