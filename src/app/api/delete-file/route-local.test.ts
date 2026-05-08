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

const { handleDeleteFile } = await import('./route-local.ts')
const { withLocalContentMutationLock } = await import('../local-content-mutation-lock.ts')

function deferred() {
	let resolve!: () => void
	const promise = new Promise<void>(next => {
		resolve = next
	})
	return { promise, resolve }
}

test('delete file local route only deletes save-file allowlisted paths', async () => {
	const source = (await fs.readFile(new URL('./route-local.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	assert.match(source, /import \{ lstat, realpath, unlink \} from 'fs\/promises'/)
	assert.match(source, /import \{ dirname, resolve \} from 'path'/)
	assert.match(source, /import \{ withLocalContentMutationLock \} from '\.\.\/local-content-mutation-lock\.ts'/)
	assert.match(source, /import \{ getSaveFileLocalContentMutationScope, isAllowedSaveFilePath \} from '\.\.\/save-file\/local-save-file-path\.ts'/)
	assert.match(source, /const projectDir = resolve\(process\.cwd\(\)\)/)
	assert.match(source, /if \(!isAllowedSaveFilePath\(projectDir, fullPath\)\) \{/)
	assert.match(source, /return NextResponse\.json\(\{ error: '路径不合法' \}, \{ status: 403 \}\)/)
	assert.match(source, /async function assertSafeDeleteFileDirectory\(fullPath: string\)/)
	assert.match(source, /const parentDir = dirname\(fullPath\)/)
	assert.match(source, /\(await realpath\(parentDir\)\) !== parentDir/)
	assert.match(source, /if \(!isAllowedSaveFilePath\(projectDir, fullPath\)\) \{[\s\S]*?return NextResponse\.json\(\{ error: '路径不合法' \}, \{ status: 403 \}\)[\s\S]*?\}\n\n\t\tconst deleteFile = async \(\) => \{\n\t\t\tawait assertSafeDeleteFileDirectory\(fullPath\)/)
	assert.match(source, /const mutationScope = getSaveFileLocalContentMutationScope\(projectDir, fullPath\)\n\t\tif \(mutationScope\) \{\n\t\t\treturn await withLocalContentMutationLock\(projectDir, mutationScope, deleteFile\)/)
	assert.doesNotMatch(source, /isPathInsideDirectory\(publicDir, fullPath\)/)
})

test('delete file local route treats missing allowlisted files as successful deletion', async () => {
	const source = (await fs.readFile(new URL('./route-local.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	assert.doesNotMatch(source, /existsSync/)
	assert.match(source, /function isFileNotFoundError\(error: unknown\)/)
	assert.match(source, /await lstat\(fullPath\)\.catch\(error => \{\n\s*if \(isFileNotFoundError\(error\)\) \{\n\s*return null\n\s*\}\n\s*throw error\n\s*\}\)/)
	assert.match(source, /if \(fileStats === null\) \{\n\s*return NextResponse\.json\(\{ success: true \}\)\n\s*\}/)
})

test('delete file local route rejects non-file allowlisted paths', async () => {
	const slug = `delete-file-nonfile-${process.pid}-${Date.now()}`
	const filePath = `public/blogs/${slug}/index.md`

	await fs.mkdir(filePath, { recursive: true })
	try {
		const response = await handleDeleteFile({
			json: async () => ({ path: filePath })
		} as any)

		assert.equal(response.status, 400)
		assert.deepEqual(await response.json(), { error: '只能删除普通文件' })
	} finally {
		await fs.rm(`public/blogs/${slug}`, { recursive: true, force: true })
	}
})

test('delete file local route rejects symlink parent directories without deleting target file', async () => {
	const previousCwd = process.cwd()
	const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'delete-file-parent-symlink-'))
	try {
		await fs.mkdir(path.join(tmpDir, 'public'), { recursive: true })
		await fs.mkdir(path.join(tmpDir, 'outside-target'), { recursive: true })
		await fs.writeFile(path.join(tmpDir, 'outside-target/storage.json'), '{}', 'utf-8')
		await fs.symlink(path.join(tmpDir, 'outside-target'), path.join(tmpDir, 'public/share'), 'dir')
		process.chdir(tmpDir)

		const response = await handleDeleteFile({
			json: async () => ({ path: 'public/share/storage.json' })
		} as any)

		assert.equal(response.status, 403)
		assert.deepEqual(await response.json(), { error: '路径不合法' })
		assert.equal(await fs.readFile(path.join(tmpDir, 'outside-target/storage.json'), 'utf-8'), '{}')
	} finally {
		process.chdir(previousCwd)
		await fs.rm(tmpDir, { recursive: true, force: true })
	}
})

test('delete file local route waits for the share content mutation lock before unlinking share artifacts', async () => {
	const previousCwd = process.cwd()
	const repoDir = await fs.mkdtemp(path.join(os.tmpdir(), 'delete-file-share-lock-'))
	const releaseLock = deferred()
	const lockEntered = deferred()
	const filePath = 'public/share/storage.json'

	try {
		await fs.mkdir(path.join(repoDir, 'public/share'), { recursive: true })
		await fs.writeFile(path.join(repoDir, filePath), '{}', 'utf-8')
		process.chdir(repoDir)

		const lock = withLocalContentMutationLock(repoDir, 'share', async () => {
			lockEntered.resolve()
			await releaseLock.promise
		})
		await lockEntered.promise

		const responsePromise = handleDeleteFile({
			json: async () => ({ path: filePath })
		} as any)
		await Promise.resolve()

		assert.equal(await fs.readFile(path.join(repoDir, filePath), 'utf-8'), '{}')

		releaseLock.resolve()
		const response = await responsePromise
		await lock

		assert.equal(response.status, 200)
		assert.deepEqual(await response.json(), { success: true })
		await assert.rejects(() => fs.readFile(path.join(repoDir, filePath), 'utf-8'), /ENOENT/)
	} finally {
		releaseLock.resolve()
		process.chdir(previousCwd)
		await fs.rm(repoDir, { recursive: true, force: true })
	}
})

test('delete file local route returns 413 for oversized request before JSON parsing', async () => {
	let jsonCalled = false
	const response = await handleDeleteFile({
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

test('delete file local route limits streamed JSON requests without content-length', async () => {
	let pulled = 0
	const encoder = new TextEncoder()
	const response = await handleDeleteFile(
		new Request('http://localhost/api/delete-file', {
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

test('delete file local route returns 400 when JSON body is malformed', async () => {
	const response = await handleDeleteFile({
		json: async () => {
			throw new SyntaxError('bad json')
		}
	} as any)

	assert.equal(response.status, 400)
	assert.deepEqual(await response.json(), { error: '请求体格式错误' })
})

test('delete file local route returns 400 when JSON body is not an object', async () => {
	for (const body of [null, []]) {
		const response = await handleDeleteFile({
			json: async () => body
		} as any)

		assert.equal(response.status, 400)
		assert.deepEqual(await response.json(), { error: '请求体格式错误' })
	}
})
