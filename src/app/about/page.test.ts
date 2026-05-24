import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const pageSource = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8')
const aboutData = JSON.parse(readFileSync(new URL('./list.json', import.meta.url), 'utf8'))

test('about hero description uses current static blog copy', () => {
	assert.equal(aboutData.description, '一个基于 Github 和 Cloudflare 的纯静态现代化博客系统')
})

test('about hero description uses stronger foreground color', () => {
	assert.match(pageSource, /<p className='text-foreground\/90 text-lg'>\{data\.description\}<\/p>/)
})
