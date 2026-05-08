import assert from 'node:assert/strict'
import test from 'node:test'
import { assertAllowedImageFile, MAX_IMAGE_FILE_BYTES } from './image-content-validation.ts'

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
