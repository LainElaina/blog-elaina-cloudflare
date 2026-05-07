import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'
import { registerHooks } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

registerHooks({
	resolve(specifier, context, nextResolve) {
		if (specifier === 'next/server') {
			return nextResolve('next/server.js', context)
		}
		return nextResolve(specifier, context)
	}
})

const { handleUploadImage, isAllowedImageContent, isAllowedUploadImagePath } = await import('./route-local.ts')

test('upload image local route writes uploaded image atomically', async () => {
	const source = await fs.readFile(new URL('./route-local.ts', import.meta.url), 'utf-8')

	assert.match(source, /import \{ mkdir, realpath, rename, rm, writeFile \} from 'fs\/promises'/)
	assert.match(source, /function buildAtomicUploadTempPath\(fullPath: string\)/)
	assert.match(source, /async function writeImageAtomically\(fullPath: string, buffer: Buffer\)/)
	assert.match(source, /await writeFile\(tempPath, buffer\)\n\t\tawait rename\(tempPath, fullPath\)/)
	assert.match(source, /await rm\(tempPath, \{ force: true \}\)\.catch\(\(\) => undefined\)/)
	assert.match(source, /await writeImageAtomically\(fullPath, buffer\)/)
	assert.doesNotMatch(source, /await writeFile\(fullPath, buffer\)/)
})

test('upload image local route rejects malformed multipart fields before file operations', async () => {
	const source = await fs.readFile(new URL('./route-local.ts', import.meta.url), 'utf-8')

	assert.match(source, /const file = formData\.get\('file'\)/)
	assert.match(source, /const path = formData\.get\('path'\)/)
	assert.match(source, /!\(file instanceof File\) \|\| typeof path !== 'string' \|\| path\.length === 0/)
	assert.doesNotMatch(source, /formData\.get\('file'\) as File/)
	assert.doesNotMatch(source, /formData\.get\('path'\) as string/)
})

test('upload image local route returns 400 for non-file upload field', async () => {
	const formData = new FormData()
	formData.set('file', 'not-a-file')
	formData.set('path', 'public/images/test.png')

	const response = await handleUploadImage({ formData: async () => formData } as any)

	assert.equal(response.status, 400)
	assert.deepEqual(await response.json(), { error: 'Missing file or path' })
})

test('upload image local route returns 400 for non-string path field', async () => {
	const formData = new FormData()
	formData.set('file', new File(['image'], 'test.png', { type: 'image/png' }))
	formData.set('path', new File(['path'], 'path.txt', { type: 'text/plain' }))

	const response = await handleUploadImage({ formData: async () => formData } as any)

	assert.equal(response.status, 400)
	assert.deepEqual(await response.json(), { error: 'Missing file or path' })
})

test('upload image local route returns 413 for oversized request before multipart parsing', async () => {
	let formDataCalled = false
	const response = await handleUploadImage({
		headers: new Headers({ 'content-length': String(11 * 1024 * 1024 + 1) }),
		formData: async () => {
			formDataCalled = true
			throw new Error('formData should not be called')
		}
	} as any)

	assert.equal(response.status, 413)
	assert.equal(formDataCalled, false)
	assert.deepEqual(await response.json(), { error: '文件大小超过 10MB 限制' })
})

test('upload image local route limits streamed multipart requests without content-length', async () => {
	let pulled = 0
	const encoder = new TextEncoder()
	const response = await handleUploadImage(
		new Request('http://localhost/api/upload-image', {
			method: 'POST',
			headers: { 'Content-Type': 'multipart/form-data; boundary=test' },
			body: new ReadableStream({
				pull(controller) {
					pulled += 1
					controller.enqueue(encoder.encode('x'.repeat(1024 * 1024)))
				}
			}),
			duplex: 'half'
		} as RequestInit)
	)

	assert.equal(response.status, 413)
	assert.equal(pulled <= 12, true)
	assert.deepEqual(await response.json(), { error: '文件大小超过 10MB 限制' })
})

test('upload image local route returns 413 for oversized file after multipart parsing', async () => {
	const formData = new FormData()
	formData.set('file', new File(['x'.repeat(10 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }))
	formData.set('path', 'public/images/share/large.png')

	const response = await handleUploadImage({ formData: async () => formData } as any)

	assert.equal(response.status, 413)
	assert.deepEqual(await response.json(), { error: '文件大小超过 10MB 限制' })
})

test('upload image local route returns 400 when multipart body is malformed', async () => {
	const response = await handleUploadImage({
		formData: async () => {
			throw new TypeError('bad multipart')
		}
	} as any)

	assert.equal(response.status, 400)
	assert.deepEqual(await response.json(), { error: '请求体格式错误' })
})

test('upload image local route rejects empty files before writing', async () => {
	const formData = new FormData()
	formData.set('file', new File([], 'empty.png', { type: 'image/png' }))
	formData.set('path', 'public/images/test-empty.png')

	const response = await handleUploadImage({ formData: async () => formData } as any)

	assert.equal(response.status, 400)
	assert.deepEqual(await response.json(), { error: '上传文件不能为空' })
})

test('upload image local route allows only upload-managed image paths', () => {
	const projectDir = resolve('/repo/blog')

	for (const path of [
		'public/favicon.png',
		'public/images/avatar.png',
		'public/images/art/hero.png',
		'public/images/background/bg.webp',
		'public/images/blogger/avatar.png',
		'public/images/custom-components/component.png',
		'public/images/pictures/picture.webp',
		'public/images/project/project.png',
		'public/images/share/logo.svg',
		'public/images/social-buttons/icon.svg',
		'public/blogs/post-a/cover.png'
	]) {
		assert.equal(isAllowedUploadImagePath(projectDir, resolve(projectDir, path)), true, path)
	}

	for (const path of [
		'public/favicon.ico',
		'public/images/christmas/snow-4.webp',
		'public/images/share/nested/logo.png',
		'public/blogs/Bad-Slug/cover.png',
		'public/blogs/post-a/nested/cover.png',
		'public/blogs-backup/post-a/cover.png'
	]) {
		assert.equal(isAllowedUploadImagePath(projectDir, resolve(projectDir, path)), false, path)
	}

	assert.equal(isAllowedUploadImagePath(projectDir, resolve('/repo/blog-backup/public/images/share/logo.png')), false)
})

test('upload image local route rejects allowlisted paths under symlinked parent directories', async () => {
	const previousCwd = process.cwd()
	const repoDir = await fs.mkdtemp(join(tmpdir(), 'upload-image-symlink-'))
	const outsideDir = await fs.mkdtemp(join(tmpdir(), 'upload-image-outside-'))
	try {
		await fs.mkdir(join(repoDir, 'public/images'), { recursive: true })
		await fs.symlink(outsideDir, join(repoDir, 'public/images/share'))
		process.chdir(repoDir)

		const formData = new FormData()
		formData.set('file', new File([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], 'test.png', { type: 'image/png' }))
		formData.set('path', 'public/images/share/test.png')

		const response = await handleUploadImage({ formData: async () => formData } as any)

		assert.equal(response.status, 500)
		assert.deepEqual(await response.json(), { error: '上传失败' })
		await assert.rejects(() => fs.readFile(join(outsideDir, 'test.png')), /ENOENT/)
	} finally {
		process.chdir(previousCwd)
		await fs.rm(repoDir, { recursive: true, force: true })
		await fs.rm(outsideDir, { recursive: true, force: true })
	}
})

test('upload image local route rejects allowlisted paths under repo-internal symlinked parent directories', async () => {
	const previousCwd = process.cwd()
	const repoDir = await fs.mkdtemp(join(tmpdir(), 'upload-image-inner-symlink-'))
	try {
		await fs.mkdir(join(repoDir, 'public/images'), { recursive: true })
		await fs.mkdir(join(repoDir, 'public/redirected-share'), { recursive: true })
		await fs.symlink(join(repoDir, 'public/redirected-share'), join(repoDir, 'public/images/share'))
		process.chdir(repoDir)

		const formData = new FormData()
		formData.set('file', new File([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], 'test.png', { type: 'image/png' }))
		formData.set('path', 'public/images/share/test.png')

		const response = await handleUploadImage({ formData: async () => formData } as any)

		assert.equal(response.status, 500)
		assert.deepEqual(await response.json(), { error: '上传失败' })
		await assert.rejects(() => fs.readFile(join(repoDir, 'public/redirected-share/test.png')), /ENOENT/)
	} finally {
		process.chdir(previousCwd)
		await fs.rm(repoDir, { recursive: true, force: true })
	}
})

test('upload image local route rejects disguised image extensions', async () => {
	const formData = new FormData()
	formData.set('file', new File(['not image'], 'fake.png', { type: 'image/png' }))
	formData.set('path', 'public/images/share/test-fake.png')

	const response = await handleUploadImage({ formData: async () => formData } as any)

	assert.equal(response.status, 400)
	assert.deepEqual(await response.json(), { error: '图片内容与文件类型不匹配' })
})

test('upload image local route validates allowed image signatures', () => {
	assert.equal(isAllowedImageContent('.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), true)
	assert.equal(isAllowedImageContent('.jpg', Buffer.from([0xff, 0xd8, 0xff, 0x00])), true)
	assert.equal(isAllowedImageContent('.gif', Buffer.from('GIF89a', 'ascii')), true)
	assert.equal(isAllowedImageContent('.webp', Buffer.from('RIFF0000WEBP', 'ascii')), true)
	assert.equal(isAllowedImageContent('.svg', Buffer.from('<?xml version="1.0"?><svg viewBox="0 0 1 1"></svg>')), true)
	assert.equal(isAllowedImageContent('.ico', Buffer.from([0x00, 0x00, 0x01, 0x00, 0x01, 0x00])), true)
	assert.equal(isAllowedImageContent('.avif', Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66, 0x00, 0x00, 0x00, 0x00])), true)
	assert.equal(isAllowedImageContent('.png', Buffer.from('not image')), false)
})
