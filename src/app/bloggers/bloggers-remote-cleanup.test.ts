import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('remote bloggers save removes avatar files no longer referenced by list', async () => {
	const source = (await fs.readFile(new URL('./services/push-bloggers.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	assert.match(source, /readTextFileFromRepo/)
	assert.match(source, /const currentAvatarUrls = new Set<string>\(\)\n\s*for \(const blogger of updatedBloggers\) \{\n\s*if \(blogger\.avatar\) \{\n\s*currentAvatarUrls\.add\(blogger\.avatar\)/)
	assert.match(source, /const previousBloggers: Blogger\[] = JSON\.parse\(previousListJson\)/)
	assert.match(source, /const previousAvatarUrls = new Set<string>\(\)[\s\S]*?previousAvatarUrls\.add\(blogger\.avatar\)/)
	assert.match(source, /if \(!currentAvatarUrls\.has\(url\) && url\.startsWith\('\/images\/blogger\/'\)\) \{\n\s*const filename = url\.replace\('\/images\/blogger\/', ''\)\n\s*const path = `public\/images\/blogger\/\$\{filename\}`[\s\S]*?sha: null/)
	assert.match(source, /throw new Error\('远程友链列表解析失败，请修复 src\/app\/bloggers\/list\.json 后重试'\)/)
	assert.doesNotMatch(source, /正在检查需要删除的文件/)
})

test('remote bloggers save reuses first uploaded avatar path for duplicate hashes', async () => {
	const source = (await fs.readFile(new URL('./services/push-bloggers.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	assert.match(source, /const uploadedAvatarPaths = new Map<string, string>\(\)/)
	assert.match(source, /const publicPath = `\/images\/blogger\/\$\{filename\}`/)
	assert.match(source, /if \(!uploadedAvatarPaths\.has\(hash\)\) \{[\s\S]*?uploadedAvatarPaths\.set\(hash, publicPath\)[\s\S]*?\}/)
	assert.match(source, /const uploadedPath = uploadedAvatarPaths\.get\(hash\)!\n\s*updatedBloggers = updatedBloggers\.map\(b => \(b\.url === url \? \{ \.\.\.b, avatar: uploadedPath \} : b\)\)/)
	assert.doesNotMatch(source, /uploadedHashes/)
})
