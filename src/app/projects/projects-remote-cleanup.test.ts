import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('remote projects save removes image files no longer referenced by list', async () => {
	const source = (await fs.readFile(new URL('./services/push-projects.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	assert.match(source, /readTextFileFromRepo/)
	assert.match(source, /function projectImageRepoDeletePath\(publicPath: string\): string \| null/)
	assert.match(source, /const pathOnly = publicPath\.split/)
	assert.match(source, /const filename = pathOnly\.slice\(PROJECT_IMAGE_PUBLIC_PREFIX\.length\)/)
	assert.match(source, /filename\.includes\('\/'\) \|\| filename\.includes\('\\\\'\) \|\| filename\.includes\('\.\.'\)/)
	assert.match(source, /const currentImagePaths = collectProjectImageRepoPaths\(updatedProjects\)/)
	assert.match(source, /const previousProjects: Project\[] = JSON\.parse\(previousListJson\)/)
	assert.match(source, /const previousImagePaths = collectProjectImageRepoPaths\(previousProjects\)/)
	assert.match(source, /for \(const path of previousImagePaths\) \{\n\s*if \(!currentImagePaths\.has\(path\)\) \{\n\s*treeItems\.push\(\{[\s\S]*?sha: null/)
	assert.doesNotMatch(source, /url\.replace\('\/images\/project\/', ''\)/)
	assert.match(source, /throw new Error\('远程项目列表解析失败，请修复 src\/app\/projects\/list\.json 后重试'\)/)
})

test('remote projects save dedupes image uploads by filename to avoid hash extension collisions', async () => {
	const source = (await fs.readFile(new URL('./services/push-projects.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	assert.match(source, /const uploadedProjectImagePaths = new Map<string, string>\(\)/)
	assert.match(source, /const publicPath = `\/images\/project\/\$\{filename\}`/)
	assert.match(source, /const filename = `\$\{hash\}\$\{ext\}`\n\s*const publicPath = `\/images\/project\/\$\{filename\}`\n\s*const uploadKey = filename/)
	assert.match(source, /if \(!uploadedProjectImagePaths\.has\(uploadKey\)\) \{[\s\S]*?uploadedProjectImagePaths\.set\(uploadKey, publicPath\)[\s\S]*?\}/)
	assert.match(source, /const uploadedPath = uploadedProjectImagePaths\.get\(uploadKey\)!\n\s*updatedProjects = updatedProjects\.map\(p => \(p\.url === url \? \{ \.\.\.p, image: uploadedPath \} : p\)\)/)
	assert.doesNotMatch(source, /uploadedProjectImagePaths\.has\(hash\)/)
	assert.doesNotMatch(source, /uploadedProjectImagePaths\.set\(hash, publicPath\)/)
	assert.doesNotMatch(source, /uploadedHashes/)
})
