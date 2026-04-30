import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

const files = [
	'../bloggers/components/avatar-upload-dialog.tsx',
	'../projects/components/image-upload-dialog.tsx',
	'./components/logo-upload-dialog.tsx'
]

test('single image upload dialogs revoke the previous selected file preview url', async () => {
	for (const file of files) {
		const source = (await fs.readFile(new URL(file, import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

		assert.match(source, /const previewUrl = URL\.createObjectURL\(file\)\n\s*if \(previewFile\) \{\n\s*URL\.revokeObjectURL\(previewFile\.previewUrl\)\n\s*\}\n\s*setPreviewFile\(\{ file, previewUrl \}\)/, file)
	}
})
