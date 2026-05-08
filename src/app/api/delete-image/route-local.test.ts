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

const { handleDeleteImage, isAllowedDeleteImagePath } = await import('./route-local.ts')
const { withLocalContentMutationLock } = await import('../local-content-mutation-lock.ts')

function deferred() {
	let resolve!: () => void
	const promise = new Promise<void>(next => {
		resolve = next
	})
	return { promise, resolve }
}

test('delete image route keeps extension validation and uses upload-managed path allowlist', async () => {
	const source = (await fs.readFile(new URL('./route-local.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	assert.match(source, /import \{ lstat, realpath, unlink \} from 'fs\/promises'/)
	assert.match(source, /import \{ dirname, extname, resolve \} from 'path'/)
	assert.match(source, /import \{ ALLOWED_IMAGE_EXTENSIONS \} from '\.\.\/\.\.\/\.\.\/lib\/image-content-validation\.ts'/)
	assert.match(source, /import \{ withLocalContentMutationLock \} from '\.\.\/local-content-mutation-lock\.ts'/)
	assert.match(source, /import \{ getLocalUploadImageMutationScope, isAllowedLocalUploadImagePath \} from '\.\.\/local-upload-image-path\.ts'/)
	assert.match(source, /export \{ isAllowedLocalUploadImagePath as isAllowedDeleteImagePath \} from '\.\.\/local-upload-image-path\.ts'/)
	assert.match(source, /const ext = extname\(filePath\)\.toLowerCase\(\)/)
	assert.match(source, /if \(!ALLOWED_IMAGE_EXTENSIONS\.has\(ext\)\) \{/)
	assert.match(source, /if \(!isAllowedLocalUploadImagePath\(projectDir, fullPath\)\) \{/)
	assert.match(source, /const mutationScope = getLocalUploadImageMutationScope\(projectDir, fullPath\)/)
	assert.match(source, /return await withLocalContentMutationLock\(projectDir, mutationScope, deleteImage\)/)
	assert.match(source, /只能删除本地上传目录内的图片文件/)
	assert.doesNotMatch(source, /isPathInsideDirectory/)
	assert.match(source, /async function assertSafeDeleteImageDirectory\(fullPath: string\)/)
	assert.match(source, /const parentDir = dirname\(fullPath\)/)
	assert.match(source, /await realpath\(parentDir\)\) !== parentDir/)
	assert.doesNotMatch(source, /assertSafeDeleteImageDirectory\(projectDir, fullPath\)/)
})


test('delete image route allows only upload-managed image paths', () => {
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
	assert.match(source, /function isFileNotFoundError\(error: unknown\)/)
	assert.match(source, /await lstat\(fullPath\)\.catch\(error => \{\n\s*if \(isFileNotFoundError\(error\)\) \{\n\s*return null\n\s*\}\n\s*throw error\n\s*\}\)/)
	assert.match(source, /if \(fileStats === null\) \{\n\s*return NextResponse\.json\(\{ success: true \}\)\n\s*\}/)
})

test('delete image route rejects non-file allowlisted paths', async () => {
	const slug = `delete-image-nonfile-${process.pid}-${Date.now()}`
	const filePath = `public/blogs/${slug}/cover.png`

	await fs.mkdir(filePath, { recursive: true })
	try {
		const response = await handleDeleteImage({
			json: async () => ({ path: filePath })
		} as any)

		assert.equal(response.status, 400)
		assert.deepEqual(await response.json(), { error: '只能删除普通文件' })
	} finally {
		await fs.rm(`public/blogs/${slug}`, { recursive: true, force: true })
	}
})

test('delete image route returns 413 for oversized request before JSON parsing', async () => {
	let jsonCalled = false
	const response = await handleDeleteImage({
		headers: new Headers({ 'content-length': String(1024 * 1024 + 1) }),
		json: async () => {
			jsonCalled = true
			throw new Error('json should not be called')
		}
	} as any)

	assert.equal(response.status, 413)
	assert.equal(jsonCalled, false)
	assert.deepEqual(await response.json(), { error: '请求体超过 1MB 限制' })
})

test('delete image route limits streamed JSON requests without content-length', async () => {
	let pulled = 0
	const encoder = new TextEncoder()
	const response = await handleDeleteImage(
		new Request('http://localhost/api/delete-image', {
			method: 'POST',
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
	assert.equal(pulled <= 2, true)
	assert.deepEqual(await response.json(), { error: '请求体超过 1MB 限制' })
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

test('delete image route waits for the share content mutation lock before unlinking share images', async () => {
	const previousCwd = process.cwd()
	const repoDir = await fs.mkdtemp(join(tmpdir(), 'delete-image-share-lock-'))
	const releaseLock = deferred()
	const lockEntered = deferred()
	const filePath = 'public/images/share/logo.png'
	const fullPath = join(repoDir, filePath)

	try {
		await fs.mkdir(join(repoDir, 'public/images/share'), { recursive: true })
		await fs.writeFile(fullPath, 'image', 'utf-8')
		process.chdir(repoDir)

		const lock = withLocalContentMutationLock(repoDir, 'share', async () => {
			lockEntered.resolve()
			await releaseLock.promise
		})
		await lockEntered.promise

		const responsePromise = handleDeleteImage({
			json: async () => ({ path: filePath })
		} as any)
		await Promise.resolve()

		assert.equal(await fs.readFile(fullPath, 'utf-8'), 'image')

		releaseLock.resolve()
		const response = await responsePromise
		await lock

		assert.equal(response.status, 200)
		assert.deepEqual(await response.json(), { success: true })
		await assert.rejects(() => fs.readFile(fullPath), /ENOENT/)
	} finally {
		releaseLock.resolve()
		process.chdir(previousCwd)
		await fs.rm(repoDir, { recursive: true, force: true })
	}
})

test('delete image route waits for the blog content mutation lock before unlinking blog images', async () => {
	const previousCwd = process.cwd()
	const repoDir = await fs.mkdtemp(join(tmpdir(), 'delete-image-blog-lock-'))
	const releaseLock = deferred()
	const lockEntered = deferred()
	const filePath = 'public/blogs/post-a/cover.png'
	const fullPath = join(repoDir, filePath)

	try {
		await fs.mkdir(join(repoDir, 'public/blogs/post-a'), { recursive: true })
		await fs.writeFile(fullPath, 'image', 'utf-8')
		process.chdir(repoDir)

		const lock = withLocalContentMutationLock(repoDir, 'blog', async () => {
			lockEntered.resolve()
			await releaseLock.promise
		})
		await lockEntered.promise

		const responsePromise = handleDeleteImage({
			json: async () => ({ path: filePath })
		} as any)
		await Promise.resolve()

		assert.equal(await fs.readFile(fullPath, 'utf-8'), 'image')

		releaseLock.resolve()
		const response = await responsePromise
		await lock

		assert.equal(response.status, 200)
		assert.deepEqual(await response.json(), { success: true })
		await assert.rejects(() => fs.readFile(fullPath), /ENOENT/)
	} finally {
		releaseLock.resolve()
		process.chdir(previousCwd)
		await fs.rm(repoDir, { recursive: true, force: true })
	}
})

test('delete image route waits for the site config mutation lock before unlinking site config images', async () => {
	const previousCwd = process.cwd()
	const repoDir = await fs.mkdtemp(join(tmpdir(), 'delete-image-site-config-lock-'))
	const releaseLock = deferred()
	const lockEntered = deferred()
	const filePath = 'public/images/social-buttons/icon.png'
	const fullPath = join(repoDir, filePath)

	try {
		await fs.mkdir(join(repoDir, 'public/images/social-buttons'), { recursive: true })
		await fs.writeFile(fullPath, 'image', 'utf-8')
		process.chdir(repoDir)

		const lock = withLocalContentMutationLock(repoDir, 'site-config', async () => {
			lockEntered.resolve()
			await releaseLock.promise
		})
		await lockEntered.promise

		const responsePromise = handleDeleteImage({
			json: async () => ({ path: filePath })
		} as any)
		await Promise.resolve()

		assert.equal(await fs.readFile(fullPath, 'utf-8'), 'image')

		releaseLock.resolve()
		const response = await responsePromise
		await lock

		assert.equal(response.status, 200)
		assert.deepEqual(await response.json(), { success: true })
		await assert.rejects(() => fs.readFile(fullPath), /ENOENT/)
	} finally {
		releaseLock.resolve()
		process.chdir(previousCwd)
		await fs.rm(repoDir, { recursive: true, force: true })
	}
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


test('delete image route rejects allowlisted direct image directories when they are symlinks', async () => {
	const previousCwd = process.cwd()
	const repoDir = await fs.mkdtemp(join(tmpdir(), 'delete-image-symlink-'))
	const outsideDir = await fs.mkdtemp(join(tmpdir(), 'delete-image-outside-'))
	const outsideFile = join(outsideDir, 'logo.png')

	try {
		await fs.mkdir(join(repoDir, 'public/images'), { recursive: true })
		await fs.writeFile(outsideFile, 'keep me')
		await fs.symlink(outsideDir, join(repoDir, 'public/images/share'))
		process.chdir(repoDir)

		const response = await handleDeleteImage(
			new Request('http://localhost/api/delete-image', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ path: 'public/images/share/logo.png' })
			}) as any
		)

		assert.equal(response.status, 403)
		assert.deepEqual(await response.json(), { error: '路径不合法，只能删除本地上传目录内的图片文件' })
		assert.equal(await fs.readFile(outsideFile, 'utf8'), 'keep me')
	} finally {
		process.chdir(previousCwd)
		await fs.rm(repoDir, { recursive: true, force: true })
		await fs.rm(outsideDir, { recursive: true, force: true })
	}
})
