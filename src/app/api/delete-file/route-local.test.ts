import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

import { handleDeleteFile } from './route-local.ts'

test('delete file local route only deletes save-file allowlisted paths', async () => {
	const source = (await fs.readFile(new URL('./route-local.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	assert.match(source, /import \{ isAllowedSaveFilePath \} from '\.\.\/save-file\/local-save-file-path\.ts'/)
	assert.match(source, /const projectDir = resolve\(process\.cwd\(\)\)/)
	assert.match(source, /if \(!isAllowedSaveFilePath\(projectDir, fullPath\)\) \{/)
	assert.match(source, /return NextResponse\.json\(\{ error: '路径不合法' \}, \{ status: 403 \}\)/)
	assert.doesNotMatch(source, /isPathInsideDirectory\(publicDir, fullPath\)/)
})

test('delete file local route treats missing allowlisted files as successful deletion', async () => {
	const source = (await fs.readFile(new URL('./route-local.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	assert.doesNotMatch(source, /existsSync/)
	assert.match(source, /await lstat\(fullPath\)\.catch\(error => \{\n\s*if \(\(error as NodeJS\.ErrnoException\)\?\.code === 'ENOENT'\) \{\n\s*return null\n\s*\}\n\s*throw error\n\s*\}\)/)
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
