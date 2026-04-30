import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('pictures upload dialog revokes replaced and rejected file preview urls', async () => {
	const source = (await fs.readFile(new URL('./components/upload-dialog.tsx', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	assert.match(source, /function revokeImagePreviews\(items: ImageItem\[\]\) \{\n\s*for \(const image of items\) \{\n\s*if \(image\.type === 'file'\) \{\n\s*URL\.revokeObjectURL\(image\.previewUrl\)/)
	assert.match(source, /if \(!file\.type\.startsWith\('image\/'\)\) \{\n\s*revokeImagePreviews\(nextImages\)\n\s*toast\.error\('请选择图片文件'\)\n\s*return/)
	assert.match(source, /revokeImagePreviews\(images\)\n\s*setImages\(nextImages\)/)
	assert.match(source, /const handleClose = \(\) => \{\n\s*revokeImagePreviews\(images\)\n\s*setImages\(\[\]\)/)
	assert.doesNotMatch(source, /images\.forEach\(image => \{\n\s*if \(image\.type === 'file'\) \{\n\s*URL\.revokeObjectURL\(image\.previewUrl\)/)
})
