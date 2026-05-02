import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('image toolbox closes ImageBitmap resources after use', async () => {
	const source = (await fs.readFile(new URL('./page.tsx', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	assert.match(source, /async function fileToWebp\(file: File, quality: number, maxWidth\?: number\) \{\n\s*const bitmap = await createImageBitmap\(file\)\n\s*try \{[\s\S]*?return blob\n\s*\} finally \{\n\s*bitmap\.close\(\)\n\s*\}\n\}/)
	assert.match(source, /const bitmap = await createImageBitmap\(file\)\n\s*try \{\n\s*return \{\n\s*file,\n\s*preview,\n\s*width: bitmap\.width,\n\s*height: bitmap\.height\n\s*\}\n\s*\} finally \{\n\s*bitmap\.close\(\)/)
})
