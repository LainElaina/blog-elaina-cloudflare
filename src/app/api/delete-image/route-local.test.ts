import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('delete image route only deletes image files inside public directory', async () => {
	const source = (await fs.readFile(new URL('./route-local.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	assert.match(source, /import \{ extname, resolve \} from 'path'/)
	assert.match(source, /const ALLOWED_IMAGE_EXTENSIONS = new Set\(\['\.jpg', '\.jpeg', '\.png', '\.gif', '\.webp', '\.svg', '\.ico', '\.avif'\]\)/)
	assert.match(source, /const ext = extname\(filePath\)\.toLowerCase\(\)/)
	assert.match(source, /if \(!ALLOWED_IMAGE_EXTENSIONS\.has\(ext\)\) \{/)
	assert.match(source, /const publicDir = resolve\(process\.cwd\(\), 'public'\)/)
	assert.match(source, /if \(!isPathInsideDirectory\(publicDir, fullPath\)\) \{/)
	assert.match(source, /只能删除 public 目录内的图片文件/)
})

test('delete image route treats missing files as successful deletion', async () => {
	const source = (await fs.readFile(new URL('./route-local.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	assert.doesNotMatch(source, /existsSync/)
	assert.match(source, /await unlink\(fullPath\)\.catch\(error => \{\n\s*if \(\(error as NodeJS\.ErrnoException\)\?\.code !== 'ENOENT'\) \{\n\s*throw error\n\s*\}\n\s*\}\)/)
})
