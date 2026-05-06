import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'
import { resolve } from 'node:path'

import { handleDeleteImage, isAllowedDeleteImagePath } from './route-local.ts'

test('delete image route keeps extension validation and uses upload-managed path allowlist', async () => {
	const source = (await fs.readFile(new URL('./route-local.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	assert.match(source, /import \{ extname, relative, resolve \} from 'path'/)
	assert.match(source, /const ALLOWED_IMAGE_EXTENSIONS = new Set\(\['\.jpg', '\.jpeg', '\.png', '\.gif', '\.webp', '\.svg', '\.ico', '\.avif'\]\)/)
	assert.match(source, /const ext = extname\(filePath\)\.toLowerCase\(\)/)
	assert.match(source, /if \(!ALLOWED_IMAGE_EXTENSIONS\.has\(ext\)\) \{/)
	assert.match(source, /if \(!isAllowedDeleteImagePath\(projectDir, fullPath\)\) \{/)
	assert.match(source, /只能删除本地上传目录内的图片文件/)
	assert.doesNotMatch(source, /isPathInsideDirectory/)
})

test('delete image route allows only upload-managed image paths', () => {
	const projectDir = resolve('/repo/blog')

	for (const path of [
		'public/favicon.png',
		'public/images/avatar.png',
		'public/images/art/hero.png',
		'public/images/background/bg.webp',
		'public/images/custom-components/component.png',
		'public/images/pictures/picture.webp',
		'public/images/project/project.png',
		'public/images/share/logo.svg',
		'public/images/social-buttons/icon.svg',
		'public/blogs/post-a/cover.png'
	]) {
		assert.equal(isAllowedDeleteImagePath(projectDir, resolve(projectDir, path)), true, path)
	}

	for (const path of [
		'public/favicon.ico',
		'public/images/christmas/snow-4.webp',
		'public/images/share/nested/logo.png',
		'public/blogs/Bad-Slug/cover.png',
		'public/blogs/post-a/nested/cover.png',
		'public/blogs-backup/post-a/cover.png'
	]) {
		assert.equal(isAllowedDeleteImagePath(projectDir, resolve(projectDir, path)), false, path)
	}

	assert.equal(isAllowedDeleteImagePath(projectDir, resolve('/repo/blog-backup/public/images/share/logo.png')), false)
})

test('delete image route treats missing files as successful deletion', async () => {
	const source = (await fs.readFile(new URL('./route-local.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	assert.doesNotMatch(source, /existsSync/)
	assert.match(source, /await unlink\(fullPath\)\.catch\(error => \{\n\s*if \(\(error as NodeJS\.ErrnoException\)\?\.code !== 'ENOENT'\) \{\n\s*throw error\n\s*\}\n\s*\}\)/)
})

test('delete image route returns 400 when JSON body is malformed', async () => {
	const response = await handleDeleteImage({
		json: async () => {
			throw new SyntaxError('bad json')
		}
	} as any)

	assert.equal(response.status, 400)
	assert.deepEqual(await response.json(), { error: '请求体格式错误' })
})

test('delete image route returns 400 when JSON body is not an object', async () => {
	for (const body of [null, []]) {
		const response = await handleDeleteImage({
			json: async () => body
		} as any)

		assert.equal(response.status, 400)
		assert.deepEqual(await response.json(), { error: '请求体格式错误' })
	}
})
