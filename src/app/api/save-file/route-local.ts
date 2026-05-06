import { mkdir, rename, rm, writeFile } from 'fs/promises'
import { dirname, extname, resolve } from 'path'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { isAllowedSaveFilePath } from './local-save-file-path.ts'

const MAX_FILE_CONTENT_SIZE = 10 * 1024 * 1024
const MAX_REQUEST_BODY_SIZE = MAX_FILE_CONTENT_SIZE + 1024 * 1024

function getContentLength(request: NextRequest) {
	const value = request.headers?.get('content-length')
	if (!value) return null
	const length = Number(value)
	return Number.isFinite(length) && length >= 0 ? length : null
}

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

function isValidJsonFileContent(fullPath: string, content: string) {
	if (extname(fullPath) !== '.json') {
		return true
	}

	try {
		JSON.parse(content)
		return true
	} catch {
		return false
	}
}

export async function handleSaveFile(request: NextRequest) {
	try {
		const contentLength = getContentLength(request)
		if (contentLength !== null && contentLength > MAX_REQUEST_BODY_SIZE) {
			return NextResponse.json({ error: '文件内容超过 10MB 限制' }, { status: 413 })
		}

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

		if (Buffer.byteLength(content, 'utf-8') > MAX_FILE_CONTENT_SIZE) {
			return NextResponse.json({ error: '文件内容超过 10MB 限制' }, { status: 413 })
		}

		const projectDir = resolve(process.cwd())
		const fullPath = resolve(process.cwd(), filePath)

		if (!isAllowedSaveFilePath(projectDir, fullPath)) {
			return NextResponse.json({ error: '路径不合法' }, { status: 403 })
		}

		if (!isValidJsonFileContent(fullPath, content)) {
			return NextResponse.json({ error: 'JSON 内容格式错误' }, { status: 400 })
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
