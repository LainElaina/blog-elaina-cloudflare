import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('delete file local route only deletes save-file allowlisted paths', async () => {
	const source = (await fs.readFile(new URL('./route-local.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	assert.match(source, /import \{ isAllowedSaveFilePath \} from '\.\.\/save-file\/local-save-file-path\.ts'/)
	assert.match(source, /const projectDir = resolve\(process\.cwd\(\)\)/)
	assert.match(source, /if \(!isAllowedSaveFilePath\(projectDir, fullPath\)\) \{/)
	assert.match(source, /return NextResponse\.json\(\{ error: '路径不合法' \}, \{ status: 403 \}\)/)
	assert.doesNotMatch(source, /isPathInsideDirectory\(publicDir, fullPath\)/)
})

test('delete file local route treats missing allowlisted files as successful deletion', async () => {
	const source = (await fs.readFile(new URL('./route-local.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	assert.doesNotMatch(source, /existsSync/)
	assert.match(source, /await unlink\(fullPath\)\.catch\(error => \{\n\s*if \(\(error as NodeJS\.ErrnoException\)\?\.code !== 'ENOENT'\) \{\n\s*throw error\n\s*\}\n\s*\}\)/)
})
