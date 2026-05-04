import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('remote bloggers save removes avatar files no longer referenced by list', async () => {
	const source = (await fs.readFile(new URL('./services/push-bloggers.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	assert.match(source, /readTextFileFromRepo/)
	assert.match(source, /function bloggerAvatarRepoDeletePath\(publicPath: string\): string \| null/)
	assert.match(source, /const pathOnly = publicPath\.split/)
	assert.match(source, /const filename = pathOnly\.slice\(BLOGGER_AVATAR_PUBLIC_PREFIX\.length\)/)
	assert.match(source, /filename\.includes\('\/'\) \|\| filename\.includes\('\\\\'\) \|\| filename\.includes\('\.\.'\)/)
	assert.match(source, /const currentAvatarPaths = collectBloggerAvatarRepoPaths\(updatedBloggers\)/)
	assert.match(source, /const previousBloggers: Blogger\[] = JSON\.parse\(previousListJson\)/)
	assert.match(source, /const previousAvatarPaths = collectBloggerAvatarRepoPaths\(previousBloggers\)/)
	assert.match(source, /for \(const path of previousAvatarPaths\) \{\n\s*if \(!currentAvatarPaths\.has\(path\)\) \{\n\s*treeItems\.push\(\{[\s\S]*?sha: null/)
	assert.doesNotMatch(source, /url\.replace\('\/images\/blogger\/', ''\)/)
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
