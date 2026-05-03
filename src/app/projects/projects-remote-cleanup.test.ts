import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('remote projects save removes image files no longer referenced by list', async () => {
	const source = (await fs.readFile(new URL('./services/push-projects.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	assert.match(source, /readTextFileFromRepo/)
	assert.match(source, /const currentImageUrls = new Set<string>\(\)\n\s*for \(const project of updatedProjects\) \{\n\s*if \(project\.image\) \{\n\s*currentImageUrls\.add\(project\.image\)/)
	assert.match(source, /const previousProjects: Project\[] = JSON\.parse\(previousListJson\)/)
	assert.match(source, /const previousImageUrls = new Set<string>\(\)[\s\S]*?previousImageUrls\.add\(project\.image\)/)
	assert.match(source, /if \(!currentImageUrls\.has\(url\) && url\.startsWith\('\/images\/project\/'\)\) \{\n\s*const filename = url\.replace\('\/images\/project\/', ''\)\n\s*const path = `public\/images\/project\/\$\{filename\}`[\s\S]*?sha: null/)
	assert.match(source, /throw new Error\('远程项目列表解析失败，请修复 src\/app\/projects\/list\.json 后重试'\)/)
})
