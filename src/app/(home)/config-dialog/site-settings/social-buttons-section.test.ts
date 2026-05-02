import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('social button removal clears pending uploaded image entry', async () => {
	const source = (await fs.readFile(new URL('./social-buttons-section.tsx', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	assert.match(source, /const handleRemoveButton = \(id: string\) => \{\n\s*setSocialButtonImageUploads\(prev => \{\n\s*const next = \{ \.\.\.prev \}\n\s*delete next\[id\]\n\s*return next\n\s*\}\)/)
	assert.match(source, /socialButtons: \(prev\.socialButtons \|\| \[\]\)\.filter\(btn => btn\.id !== id\)/)
	assert.match(source, /const handleRemoveImage = \(buttonId: string\) => \{\n\s*const uploadItem = socialButtonImageUploads\[buttonId\]\n\s*if \(uploadItem\?\.type === 'file'\) \{\n\s*URL\.revokeObjectURL\(uploadItem\.previewUrl\)/)
})
