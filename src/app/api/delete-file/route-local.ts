import { unlink } from 'fs/promises'
import { resolve } from 'path'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { isAllowedSaveFilePath } from '../save-file/local-save-file-path.ts'

export async function handleDeleteFile(request: NextRequest) {
	try {
		const { path: filePath } = await request.json()

		if (!filePath || typeof filePath !== 'string') {
			return NextResponse.json({ error: '缺少文件路径' }, { status: 400 })
		}

		const projectDir = resolve(process.cwd())
		const fullPath = resolve(process.cwd(), filePath)

		if (!isAllowedSaveFilePath(projectDir, fullPath)) {
			return NextResponse.json({ error: '路径不合法' }, { status: 403 })
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
