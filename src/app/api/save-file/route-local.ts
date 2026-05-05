import { mkdir, rename, rm, writeFile } from 'fs/promises'
import { dirname, resolve } from 'path'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { isAllowedSaveFilePath } from './local-save-file-path.ts'

function buildAtomicSaveTempPath(fullPath: string) {
	return `${fullPath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

async function writeFileAtomically(fullPath: string, content: string) {
	const tempPath = buildAtomicSaveTempPath(fullPath)
	try {
		await writeFile(tempPath, content, 'utf-8')
		await rename(tempPath, fullPath)
	} catch (error) {
		await rm(tempPath, { force: true }).catch(() => undefined)
		throw error
	}
}

export async function handleSaveFile(request: NextRequest) {
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

		const { path: filePath, content } = body as Record<string, unknown>

		if (!filePath || typeof filePath !== 'string' || typeof content !== 'string') {
			return NextResponse.json({ error: '缺少文件路径或内容' }, { status: 400 })
		}

		const projectDir = resolve(process.cwd())
		const fullPath = resolve(process.cwd(), filePath)

		if (!isAllowedSaveFilePath(projectDir, fullPath)) {
			return NextResponse.json({ error: '路径不合法' }, { status: 403 })
		}

		const dir = dirname(fullPath)
		await mkdir(dir, { recursive: true })

		await writeFileAtomically(fullPath, content)
		return NextResponse.json({ success: true })
	} catch (error: any) {
		console.error('Save file error:', error)
		return NextResponse.json({ error: '保存失败' }, { status: 500 })
	}
}
