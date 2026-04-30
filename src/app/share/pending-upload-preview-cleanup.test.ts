import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

const parentPages = [
	'../bloggers/page.tsx',
	'../projects/page.tsx',
	'../pictures/page.tsx',
	'./page.tsx'
]

test('parent pages revoke pending upload file preview urls before discarding maps', async () => {
	for (const file of parentPages) {
		const source = (await fs.readFile(new URL(file, import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

		assert.match(source, /revokeFilePreviewUrls\([^)]*\.values\(\)\)/, file)
		assert.match(source, /revokeUnusedFilePreviewUrls\([^)]*\.values\(\), [^)]*\.values\(\)\)/, file)
	}
})

test('bloggers and projects delete pending upload entries with preview cleanup', async () => {
	const cases = [
		{ file: '../bloggers/page.tsx', deleteCall: /next\.delete\(blogger\.url\)/ },
		{ file: '../projects/page.tsx', deleteCall: /next\.delete\(project\.url\)/ }
	]

	for (const { file, deleteCall } of cases) {
		const source = (await fs.readFile(new URL(file, import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

		assert.match(source, deleteCall, file)
		assert.match(source, /revokeUnusedFilePreviewUrls\(prev\.values\(\), next\.values\(\)\)/, file)
	}
})

test('preview url cleanup helper revokes only discarded file previews once', async () => {
	const source = (await fs.readFile(new URL('../../lib/upload-preview-url.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	assert.match(source, /function collectFilePreviewUrls\(items: Iterable<PreviewItem>\)/)
	assert.match(source, /if \(item\.type === 'file' && item\.previewUrl\)/)
	assert.match(source, /!retainedPreviewUrls\.has\(item\.previewUrl\) && !revokedPreviewUrls\.has\(item\.previewUrl\)/)
	assert.match(source, /URL\.revokeObjectURL\(item\.previewUrl\)/)
	assert.match(source, /export function revokeFilePreviewUrls\(items: Iterable<PreviewItem>\) \{\n\s*revokeUnusedFilePreviewUrls\(items, \[\]\)/)
})
