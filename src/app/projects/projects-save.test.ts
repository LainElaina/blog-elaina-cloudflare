import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('projects local save checks upload and save-file responses before marking projects as saved', async () => {
	const pageSource = await fs.readFile(new URL('./page.tsx', import.meta.url), 'utf-8')

	assert.match(pageSource, /await assertOk\(await fetch\('\/api\/upload-image', \{ method: 'POST', body: formData \}\), '上传项目图片'\)/)
	assert.match(pageSource, /await assertOk\(\n\s*await fetch\('\/api\/save-file'/)
	assert.match(pageSource, /'保存项目列表'/)
	assert.match(pageSource, /savedProjects = updatedProjects/)
})
