export const ALLOWED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico', '.avif'])
export const MAX_IMAGE_FILE_BYTES = 10 * 1024 * 1024

function startsWithBytes(buffer: Uint8Array, bytes: number[]) {
	return buffer.length >= bytes.length && bytes.every((byte, index) => buffer[index] === byte)
}

function asciiSlice(buffer: Uint8Array, start: number, end: number) {
	return String.fromCharCode(...buffer.slice(start, end))
}

function utf8Text(buffer: Uint8Array) {
	return new TextDecoder().decode(buffer)
}

function hasAvifSignature(buffer: Uint8Array) {
	if (buffer.length < 16 || asciiSlice(buffer, 4, 8) !== 'ftyp') return false

	const brands = [asciiSlice(buffer, 8, 12)]
	for (let offset = 16; offset + 4 <= buffer.length; offset += 4) {
		brands.push(asciiSlice(buffer, offset, offset + 4))
	}

	return brands.some(brand => brand === 'avif' || brand === 'avis')
}

function hasUnsafeSvgContent(content: string) {
	return /<\s*script(?:\s|>|\/)/i.test(content) || /\son[a-z]+\s*=/i.test(content) || /\b(?:href|xlink:href)\s*=\s*(['\"]?)\s*(?:javascript|data:text\/html)\s*:/i.test(content)
}

function hasSvgSignature(buffer: Uint8Array) {
	const content = utf8Text(buffer).replace(/^﻿/, '').trimStart()
	return /^(?:<\?xml[\s\S]*?\?>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg(?:\s|>)/i.test(content) && !hasUnsafeSvgContent(content)
}

function readUint16LE(buffer: Uint8Array, offset: number) {
	return buffer[offset] | (buffer[offset + 1] << 8)
}

export function isAllowedImageContent(extension: string, buffer: Uint8Array) {
	switch (extension.toLowerCase()) {
		case '.jpg':
		case '.jpeg':
			return startsWithBytes(buffer, [0xff, 0xd8, 0xff])
		case '.png':
			return startsWithBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
		case '.gif':
			return asciiSlice(buffer, 0, 6) === 'GIF87a' || asciiSlice(buffer, 0, 6) === 'GIF89a'
		case '.webp':
			return buffer.length >= 12 && asciiSlice(buffer, 0, 4) === 'RIFF' && asciiSlice(buffer, 8, 12) === 'WEBP'
		case '.svg':
			return hasSvgSignature(buffer)
		case '.ico':
			return buffer.length >= 6 && startsWithBytes(buffer, [0x00, 0x00, 0x01, 0x00]) && readUint16LE(buffer, 4) > 0
		case '.avif':
			return hasAvifSignature(buffer)
		default:
			return false
	}
}

export function getImageFileExtension(filename: string): string {
	const dotIndex = filename.lastIndexOf('.')
	return dotIndex >= 0 ? filename.slice(dotIndex).toLowerCase() : ''
}

export async function assertAllowedImageFile(file: File, extension: string = getImageFileExtension(file.name)): Promise<void> {
	if (!ALLOWED_IMAGE_EXTENSIONS.has(extension)) {
		throw new Error(`不允许的图片文件类型: ${extension}`)
	}
	if (file.size === 0) {
		throw new Error('图片文件不能为空')
	}
	if (file.size > MAX_IMAGE_FILE_BYTES) {
		throw new Error('图片文件不能超过 10MB')
	}
	const buffer = new Uint8Array(await file.arrayBuffer())
	if (buffer.length === 0) {
		throw new Error('图片文件不能为空')
	}
	if (!isAllowedImageContent(extension, buffer)) {
		throw new Error('图片内容与文件类型不匹配')
	}
}
