export const ALLOWED_UPLOAD_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.ico', '.avif'])
// SVG 保留为可管理扩展名，方便删除历史文件；新上传统一走 ALLOWED_UPLOAD_IMAGE_EXTENSIONS。
export const ALLOWED_IMAGE_EXTENSIONS = new Set([...ALLOWED_UPLOAD_IMAGE_EXTENSIONS, '.svg'])
export const MAX_IMAGE_FILE_BYTES = 10 * 1024 * 1024

function startsWithBytes(buffer: Uint8Array, bytes: number[]) {
	return buffer.length >= bytes.length && bytes.every((byte, index) => buffer[index] === byte)
}

function asciiSlice(buffer: Uint8Array, start: number, end: number) {
	return String.fromCharCode(...buffer.slice(start, end))
}

function hasAvifSignature(buffer: Uint8Array) {
	if (buffer.length < 16 || asciiSlice(buffer, 4, 8) !== 'ftyp') return false

	const brands = [asciiSlice(buffer, 8, 12)]
	for (let offset = 16; offset + 4 <= buffer.length; offset += 4) {
		brands.push(asciiSlice(buffer, offset, offset + 4))
	}

	return brands.some(brand => brand === 'avif' || brand === 'avis')
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
			return false
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
	if (!ALLOWED_UPLOAD_IMAGE_EXTENSIONS.has(extension)) {
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
