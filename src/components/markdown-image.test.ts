import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('markdown image component rejects unsafe markdown image URLs before rendering img and lightbox', async () => {
	const source = await readFile(new URL('./markdown-image.tsx', import.meta.url), 'utf-8')

	assert.match(source, /import \{ isSafeMarkdownImageUrl \} from '@\/lib\/markdown-url-safety'/)
	assert.match(source, /if \(!isSafeMarkdownImageUrl\(src\)\) \{\s*return alt \|\| null\s*\}/)
	assert.match(source, /<img src=\{src\}/)
	assert.match(source, /<Lightbox src=\{display \? src : null\}/)
})
