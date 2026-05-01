import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolve } from 'node:path'
import { isAllowedSaveFilePath } from './local-save-file-path.ts'

test('save-file local route allows only known content files and blog artifacts', () => {
	const projectDir = resolve('/repo/blog')

	assert.equal(isAllowedSaveFilePath(projectDir, resolve(projectDir, 'src/app/about/list.json')), true)
	assert.equal(isAllowedSaveFilePath(projectDir, resolve(projectDir, 'public/share/storage.json')), true)
	assert.equal(isAllowedSaveFilePath(projectDir, resolve(projectDir, 'public/blogs/post-a/index.md')), true)
	assert.equal(isAllowedSaveFilePath(projectDir, resolve(projectDir, 'public/blogs/post-a/config.json')), true)
})

test('save-file local route rejects project files outside the write allowlist', () => {
	const projectDir = resolve('/repo/blog')

	assert.equal(isAllowedSaveFilePath(projectDir, resolve(projectDir, 'package.json')), false)
	assert.equal(isAllowedSaveFilePath(projectDir, resolve(projectDir, '.env')), false)
	assert.equal(isAllowedSaveFilePath(projectDir, resolve(projectDir, 'src/app/api/save-file/route-local.ts')), false)
	assert.equal(isAllowedSaveFilePath(projectDir, resolve(projectDir, 'public/blogs-backup/post-a/index.md')), false)
	assert.equal(isAllowedSaveFilePath(projectDir, resolve('/repo/blog-backup/public/blogs/post-a/index.md')), false)
})
