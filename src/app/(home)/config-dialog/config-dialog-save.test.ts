import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('color preset local save checks config response before reporting success', async () => {
	const source = await fs.readFile(new URL('./color-config.tsx', import.meta.url), 'utf-8')

	assert.match(source, /const response = await fetch\('\/api\/config'/)
	assert.match(source, /if \(!response\.ok\) \{/)
	assert.match(source, /throw new Error\('保存色彩预设失败'\)/)
	assert.match(source, /toast\.success\('色彩预设已保存到项目'\)/)
})

test('home layout local reset checks draft save response before reloading', async () => {
	const source = await fs.readFile(new URL('./home-layout.tsx', import.meta.url), 'utf-8')

	assert.match(source, /const response = await fetch\('\/api\/drafts\/site-config'/)
	assert.match(source, /if \(!response\.ok\) \{/)
	assert.match(source, /throw new Error\('保存布局草稿失败'\)/)
	assert.match(source, /toast\.success\('重置已保存到项目，即将刷新页面\.\.\.'\)/)
})
