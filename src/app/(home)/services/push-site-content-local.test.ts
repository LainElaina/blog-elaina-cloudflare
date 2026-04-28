import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('local site config publish fails when deleting removed assets fails', async () => {
	const source = await fs.readFile(new URL('./push-site-content-local.ts', import.meta.url), 'utf-8')

	assert.match(source, /async function deleteFile\(path: string\): Promise<void> \{/)
	assert.match(source, /throw new Error\(`删除 \$\{path\} 失败`\)/)
	assert.doesNotMatch(source, /console\.error\(`删除 \$\{path\} 失败`\)/)
})
