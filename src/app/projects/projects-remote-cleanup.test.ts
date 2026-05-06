import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

import { buildUnusedProjectImageDeleteTreeItems, filterExistingProjectImageDeleteTreeItems } from './services/push-projects'

test('remote projects save filters delete items to existing baseline image files', () => {
	const previousProjects = [
		{
			url: 'https://old.example.com',
			image: '/images/project/old.png'
		},
		{
			url: 'https://missing.example.com',
			image: '/images/project/missing.png?version=1'
		},
		{
			url: 'https://unsafe.example.com',
			image: '/images/project/../secret.png'
		}
	]
	const currentProjects = [
		{
			url: 'https://current.example.com',
			image: '/images/project/current.png'
		}
	]

	const deleteItems = buildUnusedProjectImageDeleteTreeItems(previousProjects, currentProjects)

	assert.deepEqual(filterExistingProjectImageDeleteTreeItems(deleteItems, ['public/images/project/old.png']), [
		{
			path: 'public/images/project/old.png',
			mode: '100644',
			type: 'blob',
			sha: null
		}
	])
})

test('remote projects save removes image files no longer referenced by list', async () => {
	const source = (await fs.readFile(new URL('./services/push-projects.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	assert.match(source, /readTextFileFromRepo/)
	assert.match(source, /listRepoFilesRecursive\([^\n]*'public\/images\/project', latestCommitSha\)/)
	assert.match(source, /function projectImageRepoDeletePath\(publicPath: string\): string \| null/)
	assert.match(source, /const pathOnly = publicPath\.split/)
	assert.match(source, /const filename = pathOnly\.slice\(PROJECT_IMAGE_PUBLIC_PREFIX\.length\)/)
	assert.match(source, /filename\.includes\('\/'\) \|\| filename\.includes\('\\\\'\) \|\| filename\.includes\('\.\.'\)/)
	assert.match(source, /const previousProjects: Project\[] = JSON\.parse\(previousListJson\)/)
	assert.match(source, /filterExistingProjectImageDeleteTreeItems\(/)
	assert.match(source, /buildUnusedProjectImageDeleteTreeItems\(previousProjects, updatedProjects\)/)
	assert.match(source, /treeItems\.push\(\.\.\.deleteTreeItems\)/)
	assert.doesNotMatch(source, /for \(const path of previousImagePaths\)/)
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
