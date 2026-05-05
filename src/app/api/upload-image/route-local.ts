import { existsSync } from 'fs'
import { mkdir, rename, rm, writeFile } from 'fs/promises'
import { dirname, extname, resolve } from 'path'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { isPathInsideDirectory } from '../local-path'

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico', '.avif'])
const MAX_FILE_SIZE = 10 * 1024 * 1024

function buildAtomicUploadTempPath(fullPath: string) {
	return `${fullPath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

async function writeImageAtomically(fullPath: string, buffer: Buffer) {
	const tempPath = buildAtomicUploadTempPath(fullPath)
	try {
		await writeFile(tempPath, buffer)
		await rename(tempPath, fullPath)
	} catch (error) {
		await rm(tempPath, { force: true }).catch(() => undefined)
		throw error
	}
}

export async function handleUploadImage(request: NextRequest) {
	try {
		const formData = await request.formData()
		const file = formData.get('file') as File
		const path = formData.get('path') as string

		if (!file || !path) {
			return NextResponse.json({ error: 'Missing file or path' }, { status: 400 })
		}

		if (file.size > MAX_FILE_SIZE) {
			return NextResponse.json({ error: '文件大小超过 10MB 限制' }, { status: 400 })
		}

		const ext = extname(path).toLowerCase()
		if (!ALLOWED_EXTENSIONS.has(ext)) {
			return NextResponse.json({ error: `不允许的文件类型: ${ext}` }, { status: 400 })
		}

		const publicDir = resolve(process.cwd(), 'public')
		const fullPath = resolve(process.cwd(), path)

		if (!isPathInsideDirectory(publicDir, fullPath)) {
			return NextResponse.json({ error: `路径不合法，只能写入 public 目录` }, { status: 403 })
		}

		const bytes = await file.arrayBuffer()
		const buffer = Buffer.from(bytes)

		const dir = dirname(fullPath)
		if (!existsSync(dir)) {
			await mkdir(dir, { recursive: true })
		}

		await writeImageAtomically(fullPath, buffer)

		return NextResponse.json({ success: true, path })
	} catch (error: any) {
		console.error('Upload error:', error)
		return NextResponse.json({ error: '上传失败' }, { status: 500 })
	}
}
