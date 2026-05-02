import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('delete dir route only allows deleting blog subdirectories', async () => {
	const source = (await fs.readFile(new URL('./route-local.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	assert.match(source, /import \{ isPathStrictlyInsideDirectory \} from '\.\.\/local-path'/)
	assert.match(source, /const blogDir = resolve\(process\.cwd\(\), 'public\/blogs'\)/)
	assert.match(source, /if \(!isPathStrictlyInsideDirectory\(blogDir, fullPath\)\) \{/)
	assert.match(source, /只能删除 public\/blogs 目录内的子目录/)
	assert.doesNotMatch(source, /isPathInsideDirectory\(publicDir, fullPath\)/)
})

test('delete dir route removes targets idempotently without existsSync race', async () => {
	const source = (await fs.readFile(new URL('./route-local.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	assert.doesNotMatch(source, /existsSync/)
	assert.match(source, /await rm\(fullPath, \{ recursive: true, force: true \}\)/)
})
