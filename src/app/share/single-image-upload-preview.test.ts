import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

const files = [
	'../bloggers/components/avatar-upload-dialog.tsx',
	'../projects/components/image-upload-dialog.tsx',
	'./components/logo-upload-dialog.tsx'
]

test('single image upload dialogs revoke stale file preview urls without revoking submitted previews', async () => {
	for (const file of files) {
		const source = (await fs.readFile(new URL(file, import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

		assert.match(source, /const previewFileRef = useRef\(previewFile\)/, file)
		assert.match(source, /useEffect\(\(\) => \{\n\s*return \(\) => \{\n\s*if \(previewFileRef\.current\) \{\n\s*URL\.revokeObjectURL\(previewFileRef\.current\.previewUrl\)/, file)
		assert.match(source, /const previewUrl = URL\.createObjectURL\(file\)\n\s*if \(previewFileRef\.current\) \{\n\s*URL\.revokeObjectURL\(previewFileRef\.current\.previewUrl\)\n\s*\}\n\s*const nextPreviewFile = \{ file, previewUrl \}\n\s*previewFileRef\.current = nextPreviewFile\n\s*setPreviewFile\(nextPreviewFile\)/, file)
		assert.match(source, /setPreviewFile\(null\)\n\s*previewFileRef\.current = null\n\s*setUrlInput\(current(?:Image|Avatar|Logo) \|\| ''\)\n\s*onClose\(\)/, file)
		assert.match(source, /if \(previewFileRef\.current\) \{\n\s*URL\.revokeObjectURL\(previewFileRef\.current\.previewUrl\)\n\s*previewFileRef\.current = null\n\s*setPreviewFile\(null\)/, file)
	}
})
