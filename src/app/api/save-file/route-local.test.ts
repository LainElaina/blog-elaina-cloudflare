import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolve } from 'node:path'
import { isAllowedSaveFilePath } from './local-save-file-path.ts'
import { handleSaveFile } from './route-local.ts'

test('save-file local route allows only known content files and blog artifacts', () => {
	const projectDir = resolve('/repo/blog')

	assert.equal(isAllowedSaveFilePath(projectDir, resolve(projectDir, 'src/app/about/list.json')), true)
	assert.equal(isAllowedSaveFilePath(projectDir, resolve(projectDir, 'public/share/storage.json')), true)
	assert.equal(isAllowedSaveFilePath(projectDir, resolve(projectDir, 'public/blogs/post-a/index.md')), true)
	assert.equal(isAllowedSaveFilePath(projectDir, resolve(projectDir, 'public/blogs/post-a/config.json')), true)
})

test('save-file local route rejects blog artifact directory root as a file path', () => {
	const projectDir = resolve('/repo/blog')

	assert.equal(isAllowedSaveFilePath(projectDir, resolve(projectDir, 'public/blogs')), false)
})

test('save-file local route rejects project files outside the write allowlist', () => {
	const projectDir = resolve('/repo/blog')

	assert.equal(isAllowedSaveFilePath(projectDir, resolve(projectDir, 'package.json')), false)
	assert.equal(isAllowedSaveFilePath(projectDir, resolve(projectDir, '.env')), false)
	assert.equal(isAllowedSaveFilePath(projectDir, resolve(projectDir, 'src/app/api/save-file/route-local.ts')), false)
	assert.equal(isAllowedSaveFilePath(projectDir, resolve(projectDir, 'public/blogs-backup/post-a/index.md')), false)
	assert.equal(isAllowedSaveFilePath(projectDir, resolve('/repo/blog-backup/public/blogs/post-a/index.md')), false)
})

test('save-file local route creates parent directories without an existence precheck', async () => {
	const source = await import('node:fs/promises').then(fs => fs.readFile(new URL('./route-local.ts', import.meta.url), 'utf-8'))

	assert.doesNotMatch(source, /existsSync/)
	assert.match(source, /await mkdir\(dir, \{ recursive: true \}\)/)
})

test('save-file local route replaces files atomically', async () => {
	const source = await import('node:fs/promises').then(fs => fs.readFile(new URL('./route-local.ts', import.meta.url), 'utf-8'))

	assert.match(source, /import \{ mkdir, rename, rm, writeFile \} from 'fs\/promises'/)
	assert.match(source, /function buildAtomicSaveTempPath\(fullPath: string\)/)
	assert.match(source, /await writeFile\(tempPath, content, 'utf-8'\)\n\t\tawait rename\(tempPath, fullPath\)/)
	assert.match(source, /await rm\(tempPath, \{ force: true \}\)\.catch\(\(\) => undefined\)/)
	assert.match(source, /await writeFileAtomically\(fullPath, content\)/)
	assert.doesNotMatch(source, /await writeFile\(fullPath, content, 'utf-8'\)/)
})

test('save-file local route returns 400 when JSON body is malformed', async () => {
	const response = await handleSaveFile({
		json: async () => {
			throw new SyntaxError('bad json')
		}
	} as any)

	assert.equal(response.status, 400)
	assert.deepEqual(await response.json(), { error: '请求体格式错误' })
})
