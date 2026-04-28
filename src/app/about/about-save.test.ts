import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('about local save checks save-file response before marking the edit as saved', async () => {
	const pageSource = await fs.readFile(new URL('./page.tsx', import.meta.url), 'utf-8')

	assert.match(pageSource, /const response = await fetch\('\/api\/save-file'/)
	assert.match(pageSource, /if \(!response\.ok\) \{/)
	assert.match(pageSource, /throw new Error\('保存关于页面失败'\)/)
	assert.match(pageSource, /setOriginalData\(data\)/)
})
