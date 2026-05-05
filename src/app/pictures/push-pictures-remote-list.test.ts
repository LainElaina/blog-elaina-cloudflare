import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('remote pictures publish blocks when previous list cannot be parsed', async () => {
	const source = await fs.readFile(new URL('./services/push-pictures.ts', import.meta.url), 'utf-8')

	assert.match(source, /catch \(error\) \{\n\s*console\.error\('Failed to parse previous list\.json:', error\)\n\s*throw new Error\('远程图床列表解析失败，请修复 src\/app\/pictures\/list\.json 后重试'\)/)
	assert.doesNotMatch(source, /catch \(error\) \{\n\s*console\.error\('Failed to parse previous list\.json:', error\)\n\s*\}\n\s*\}/)
})

test('remote pictures save only deletes safe local image paths', async () => {
	const source = (await fs.readFile(new URL('./services/push-pictures.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	assert.match(source, /function pictureImageRepoDeletePath\(publicPath: string\): string \| null/)
	assert.match(source, /const pathOnly = publicPath\.split/)
	assert.match(source, /const filename = pathOnly\.slice\(PICTURE_IMAGE_PUBLIC_PREFIX\.length\)/)
	assert.match(source, /filename\.includes\('\/'\) \|\| filename\.includes\('\\\\'\) \|\| filename\.includes\('\.\.'\)/)
	assert.match(source, /const currentImagePaths = collectPictureImageRepoPaths\(updatedPictures\)/)
	assert.match(source, /const previousImagePaths = collectPictureImageRepoPaths\(previousPictures\)/)
	assert.match(source, /for \(const path of previousImagePaths\) \{\n\s*if \(!currentImagePaths\.has\(path\)\) \{\n\s*treeItems\.push\(\{[\s\S]*?sha: null/)
	assert.doesNotMatch(source, /url\.replace\('\/images\/pictures\/', ''\)/)
})

test('remote pictures save dedupes image uploads by filename to avoid hash extension collisions', async () => {
	const source = (await fs.readFile(new URL('./services/push-pictures.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	assert.match(source, /const uploadedPicturePaths = new Map<string, string>\(\)/)
	assert.match(source, /const publicPath = `\/images\/pictures\/\$\{filename\}`/)
	assert.match(source, /const filename = `\$\{hash\}\$\{ext\}`\n\s*const publicPath = `\/images\/pictures\/\$\{filename\}`\n\s*const uploadKey = filename/)
	assert.match(source, /if \(!uploadedPicturePaths\.has\(uploadKey\)\) \{[\s\S]*?uploadedPicturePaths\.set\(uploadKey, publicPath\)[\s\S]*?\}/)
	assert.match(source, /const uploadedPath = uploadedPicturePaths\.get\(uploadKey\)!\n\s*const \[groupId, indexStr\] = key\.split\('::'\)/)
	assert.match(source, /const nextImages = currentImages\.map\(\(img, idx\) => \(idx === imageIndex \? uploadedPath : img\)\)/)
	assert.doesNotMatch(source, /uploadedPicturePaths\.has\(hash\)/)
	assert.doesNotMatch(source, /uploadedPicturePaths\.set\(hash, publicPath\)/)
	assert.doesNotMatch(source, /uploadedHashes/)
})
