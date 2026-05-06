import { existsSync } from 'fs'
import { mkdir, rename, rm, writeFile } from 'fs/promises'
import { dirname, extname, resolve } from 'path'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { isPathInsideDirectory } from '../local-path'

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico', '.avif'])
const MAX_FILE_SIZE = 10 * 1024 * 1024

function startsWithBytes(buffer: Buffer, bytes: number[]) {
	return buffer.length >= bytes.length && bytes.every((byte, index) => buffer[index] === byte)
}

function hasAvifSignature(buffer: Buffer) {
	if (buffer.length < 16 || buffer.toString('ascii', 4, 8) !== 'ftyp') return false

	const brands = [buffer.toString('ascii', 8, 12)]
	for (let offset = 16; offset + 4 <= buffer.length; offset += 4) {
		brands.push(buffer.toString('ascii', offset, offset + 4))
	}

	return brands.some(brand => brand === 'avif' || brand === 'avis')
}

function hasSvgSignature(buffer: Buffer) {
	const content = buffer.toString('utf8').replace(/^\uFEFF/, '').trimStart()
	return /^(?:<\?xml[\s\S]*?\?>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg(?:\s|>)/i.test(content)
}

export function isAllowedImageContent(extension: string, buffer: Buffer) {
	switch (extension.toLowerCase()) {
		case '.jpg':
		case '.jpeg':
			return startsWithBytes(buffer, [0xff, 0xd8, 0xff])
		case '.png':
			return startsWithBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
		case '.gif':
			return buffer.toString('ascii', 0, 6) === 'GIF87a' || buffer.toString('ascii', 0, 6) === 'GIF89a'
		case '.webp':
			return buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP'
		case '.svg':
			return hasSvgSignature(buffer)
		case '.ico':
			return buffer.length >= 6 && startsWithBytes(buffer, [0x00, 0x00, 0x01, 0x00]) && buffer.readUInt16LE(4) > 0
		case '.avif':
			return hasAvifSignature(buffer)
		default:
			return false
	}
}

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
		let formData: FormData
		try {
			formData = await request.formData()
		} catch {
			return NextResponse.json({ error: '请求体格式错误' }, { status: 400 })
		}

		const file = formData.get('file')
		const path = formData.get('path')

		if (!(file instanceof File) || typeof path !== 'string' || path.length === 0) {
			return NextResponse.json({ error: 'Missing file or path' }, { status: 400 })
		}

		if (file.size === 0) {
			return NextResponse.json({ error: '上传文件不能为空' }, { status: 400 })
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
		if (buffer.length === 0) {
			return NextResponse.json({ error: '上传文件不能为空' }, { status: 400 })
		}
		if (!isAllowedImageContent(ext, buffer)) {
			return NextResponse.json({ error: '图片内容与文件类型不匹配' }, { status: 400 })
		}

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
