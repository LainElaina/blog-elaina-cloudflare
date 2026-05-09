import assert from 'node:assert/strict'
import test from 'node:test'
import { ALLOWED_IMAGE_EXTENSIONS, ALLOWED_UPLOAD_IMAGE_EXTENSIONS, assertAllowedImageFile, MAX_IMAGE_FILE_BYTES } from './image-content-validation.ts'

test('assertAllowedImageFile rejects oversized files before reading content', async () => {
	let readCalled = false
	const file = {
		name: 'large.png',
		size: MAX_IMAGE_FILE_BYTES + 1,
		async arrayBuffer() {
			readCalled = true
			return new ArrayBuffer(0)
		}
	} as File

	await assert.rejects(() => assertAllowedImageFile(file, '.png'), /图片文件不能超过 10MB/)
	assert.equal(readCalled, false)
})

test('SVG files remain manageable but are not accepted for new uploads', async () => {
	assert.equal(ALLOWED_IMAGE_EXTENSIONS.has('.svg'), true)
	assert.equal(ALLOWED_UPLOAD_IMAGE_EXTENSIONS.has('.svg'), false)

	const file = new File(['<svg viewBox="0 0 1 1"></svg>'], 'icon.svg', { type: 'image/svg+xml' })
	await assert.rejects(() => assertAllowedImageFile(file, '.svg'), /不允许的图片文件类型: \.svg/)
})
