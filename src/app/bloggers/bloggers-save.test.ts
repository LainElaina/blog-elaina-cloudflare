import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('bloggers local save checks upload and save-file responses before marking bloggers as saved', async () => {
	const pageSource = await fs.readFile(new URL('./page.tsx', import.meta.url), 'utf-8')

	assert.match(pageSource, /await assertOk\(await fetch\('\/api\/upload-image', \{ method: 'POST', body: formData \}\), '上传友链头像'\)/)
	assert.match(pageSource, /await assertOk\(\n\s*await fetch\('\/api\/save-file'/)
	assert.match(pageSource, /'保存友链列表'/)
	assert.match(pageSource, /savedBloggers = updatedBloggers/)
})
