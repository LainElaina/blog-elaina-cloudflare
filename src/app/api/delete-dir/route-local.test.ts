import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'
import { registerHooks } from 'node:module'
import os from 'node:os'
import path from 'node:path'

registerHooks({
	resolve(specifier, context, nextResolve) {
		if (specifier === 'next/server') {
			return nextResolve('next/server.js', context)
		}
		return nextResolve(specifier, context)
	}
})

const { handleDeleteDir } = await import('./route-local.ts')

test('delete dir route only allows deleting single safe blog directories', async () => {
	const source = (await fs.readFile(new URL('./route-local.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	assert.match(source, /import \{ lstat, realpath, rm \} from 'fs\/promises'/)
	assert.match(source, /import \{ dirname, relative, resolve \} from 'path'/)
	assert.match(source, /import \{ assertSafeBlogSlug \} from '\.\.\/\.\.\/write\/services\/blog-slug\.ts'/)
	assert.match(source, /function isAllowedBlogDirectoryPath\(blogDir: string, fullPath: string\)/)
	assert.match(source, /assertSafeBlogSlug\(relative\(blogDir, fullPath\)\)/)
	assert.match(source, /只能删除 public\/blogs 下的文章目录/)
	assert.match(source, /async function assertSafeDeleteDirParent\(fullPath: string\)/)
	assert.match(source, /const parentDir = dirname\(fullPath\)/)
	assert.match(source, /\(await realpath\(parentDir\)\) !== parentDir/)
	assert.match(source, /await assertSafeDeleteDirParent\(fullPath\)/)
	assert.match(source, /const targetStat = await lstat\(fullPath\)/)
	assert.match(source, /if \(!targetStat\.isDirectory\(\)\) \{/)
	assert.match(source, /只能删除文章目录/)
	assert.doesNotMatch(source, /isPathInsideDirectory\(publicDir, fullPath\)/)
})

test('delete dir route rejects files and nested paths before removing', async () => {
	const source = (await fs.readFile(new URL('./route-local.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	assert.match(source, /if \(!isAllowedBlogDirectoryPath\(blogDir, fullPath\)\) \{[\s\S]*?return NextResponse\.json\(\{ error: '路径不合法，只能删除 public\/blogs 下的文章目录' \}, \{ status: 403 \}\)[\s\S]*?\}\n\n\t\tawait assertSafeDeleteDirParent\(fullPath\)\n\n\t\ttry \{\n\t\t\tconst targetStat = await lstat\(fullPath\)/)
	assert.match(source, /assertSafeBlogSlug\(relative\(blogDir, fullPath\)\)/)
	assert.doesNotMatch(source, /await rm\(fullPath, \{ recursive: true, force: true \}\)[\s\S]*?const targetStat = await lstat\(fullPath\)/)
})

test('delete dir route treats missing safe blog directory as already deleted', async () => {
	const response = await handleDeleteDir({
		json: async () => ({ path: 'public/blogs/missing-safe-post' })
	} as any)

	assert.equal(response.status, 200)
	assert.deepEqual(await response.json(), { success: true })
})

test('delete dir route rejects symlink blog directories without removing target directory', async () => {
	const previousCwd = process.cwd()
	const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'delete-dir-symlink-'))
	try {
		await fs.mkdir(path.join(tmpDir, 'public/blogs'), { recursive: true })
		await fs.mkdir(path.join(tmpDir, 'outside-target'), { recursive: true })
		await fs.writeFile(path.join(tmpDir, 'outside-target/keep.txt'), 'keep', 'utf-8')
		await fs.symlink(path.join(tmpDir, 'outside-target'), path.join(tmpDir, 'public/blogs/post-a'), 'dir')
		process.chdir(tmpDir)

		const response = await handleDeleteDir({
			json: async () => ({ path: 'public/blogs/post-a' })
		} as any)

		assert.equal(response.status, 403)
		assert.deepEqual(await response.json(), { error: '路径不合法，只能删除文章目录' })
		assert.equal(await fs.readFile(path.join(tmpDir, 'outside-target/keep.txt'), 'utf-8'), 'keep')
		assert.equal((await fs.lstat(path.join(tmpDir, 'public/blogs/post-a'))).isSymbolicLink(), true)
	} finally {
		process.chdir(previousCwd)
		await fs.rm(tmpDir, { recursive: true, force: true })
	}
})

test('delete dir route rejects symlink parent directories without removing target directory', async () => {
	const previousCwd = process.cwd()
	const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'delete-dir-parent-symlink-'))
	try {
		await fs.mkdir(path.join(tmpDir, 'public'), { recursive: true })
		await fs.mkdir(path.join(tmpDir, 'outside-target/post-a'), { recursive: true })
		await fs.writeFile(path.join(tmpDir, 'outside-target/post-a/keep.txt'), 'keep', 'utf-8')
		await fs.symlink(path.join(tmpDir, 'outside-target'), path.join(tmpDir, 'public/blogs'), 'dir')
		process.chdir(tmpDir)

		const response = await handleDeleteDir({
			json: async () => ({ path: 'public/blogs/post-a' })
		} as any)

		assert.equal(response.status, 500)
		assert.deepEqual(await response.json(), { error: '删除失败' })
		assert.equal(await fs.readFile(path.join(tmpDir, 'outside-target/post-a/keep.txt'), 'utf-8'), 'keep')
	} finally {
		process.chdir(previousCwd)
		await fs.rm(tmpDir, { recursive: true, force: true })
	}
})


test('delete dir route returns 413 for oversized request before JSON parsing', async () => {
	let jsonCalled = false
	const response = await handleDeleteDir({
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

test('delete dir route limits streamed JSON requests without content-length', async () => {
	let pulled = 0
	const encoder = new TextEncoder()
	const response = await handleDeleteDir(
		new Request('http://localhost/api/delete-dir', {
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

test('delete dir route returns 400 when JSON body is malformed', async () => {
	const response = await handleDeleteDir({
		json: async () => {
			throw new SyntaxError('bad json')
		}
	} as any)

	assert.equal(response.status, 400)
	assert.deepEqual(await response.json(), { error: '请求体格式错误' })
})

test('delete dir route returns 400 when JSON body is not an object', async () => {
	for (const body of [null, []]) {
		const response = await handleDeleteDir({
			json: async () => body
		} as any)

		assert.equal(response.status, 400)
		assert.deepEqual(await response.json(), { error: '请求体格式错误' })
	}
})
