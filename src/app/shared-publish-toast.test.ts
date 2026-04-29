import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

const pageServices = [
	'about/services/push-about.ts',
	'projects/services/push-projects.ts',
	'bloggers/services/push-bloggers.ts',
	'pictures/services/push-pictures.ts',
	'share/services/push-shares.ts',
	'snippets/services/push-snippets.ts'
]

test('page publish services leave final success toast to page save handlers', async () => {
	for (const servicePath of pageServices) {
		const source = await fs.readFile(new URL(`./${servicePath}`, import.meta.url), 'utf-8')
		assert.doesNotMatch(source, /toast\.success\('发布成功！'\)/, servicePath)
	}
})
