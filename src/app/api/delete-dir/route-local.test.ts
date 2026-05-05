import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

import { handleDeleteDir } from './route-local.ts'

test('delete dir route only allows deleting single safe blog directories', async () => {
	const source = (await fs.readFile(new URL('./route-local.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	assert.match(source, /import \{ rm, stat \} from 'fs\/promises'/)
	assert.match(source, /import \{ assertSafeBlogSlug \} from '\.\.\/\.\.\/write\/services\/blog-slug'/)
	assert.match(source, /function isAllowedBlogDirectoryPath\(blogDir: string, fullPath: string\)/)
	assert.match(source, /assertSafeBlogSlug\(relative\(blogDir, fullPath\)\)/)
	assert.match(source, /只能删除 public\/blogs 下的文章目录/)
	assert.match(source, /const targetStat = await stat\(fullPath\)/)
	assert.match(source, /if \(!targetStat\.isDirectory\(\)\) \{/)
	assert.match(source, /只能删除文章目录/)
	assert.doesNotMatch(source, /isPathInsideDirectory\(publicDir, fullPath\)/)
})

test('delete dir route rejects files and nested paths before removing', async () => {
	const source = (await fs.readFile(new URL('./route-local.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	assert.match(source, /if \(!isAllowedBlogDirectoryPath\(blogDir, fullPath\)\) \{[\s\S]*?return NextResponse\.json\(\{ error: '路径不合法，只能删除 public\/blogs 下的文章目录' \}, \{ status: 403 \}\)[\s\S]*?\}\n\n\t\ttry \{\n\t\t\tconst targetStat = await stat\(fullPath\)/)
	assert.match(source, /assertSafeBlogSlug\(relative\(blogDir, fullPath\)\)/)
	assert.doesNotMatch(source, /await rm\(fullPath, \{ recursive: true, force: true \}\)[\s\S]*?const targetStat = await stat\(fullPath\)/)
})

test('delete dir route treats missing safe blog directory as already deleted', async () => {
	const response = await handleDeleteDir({
		json: async () => ({ path: 'public/blogs/missing-safe-post' })
	} as any)

	assert.equal(response.status, 200)
	assert.deepEqual(await response.json(), { success: true })
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
