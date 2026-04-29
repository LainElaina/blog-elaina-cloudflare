import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('remote blog publish emits one success toast from the publish hook', async () => {
	const hookSource = await fs.readFile(new URL('./hooks/use-publish.ts', import.meta.url), 'utf-8')
	const serviceSource = await fs.readFile(new URL('./services/push-blog.ts', import.meta.url), 'utf-8')

	assert.match(hookSource, /const successMsg = mode === 'edit' \? '更新成功' : '发布成功'\n\s*toast\.success\(successMsg\)/)
	assert.doesNotMatch(serviceSource, /toast\.success\('发布成功！'\)/)
})
