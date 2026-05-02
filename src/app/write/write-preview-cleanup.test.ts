import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('write pages dispose local file previews on unmount', async () => {
	const storeSource = (await fs.readFile(new URL('./stores/write-store.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')
	const createPageSource = (await fs.readFile(new URL('./page.tsx', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')
	const editPageSource = (await fs.readFile(new URL('./[slug]/page.tsx', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	assert.match(storeSource, /loadBlogForEdit: \(slug: string\) => Promise<boolean>\n\s*disposeLocalFilePreviews: \(\) => void/)
	assert.match(storeSource, /disposeLocalFilePreviews: \(\) =>\n\s*set\(state => \{\n\s*revokePreviewUrls\(state\.images, state\.cover\)\n\s*return \{\n\s*images: state\.images\.filter\(image => image\.type !== 'file'\),\n\s*cover: state\.cover\?\.type === 'file' \? null : state\.cover/)
	assert.match(createPageSource, /const \{ form, cover, images, replaceWithSnapshot, disposeLocalFilePreviews \} = useWriteStore\(\)/)
	assert.match(createPageSource, /useEffect\(\(\) => \{\n\s*return \(\) => \{\n\s*disposeLocalFilePreviews\(\)\n\s*\}\n\s*\}, \[disposeLocalFilePreviews\]\)/)
	assert.match(editPageSource, /const \{ form, cover, images, originalSlug, replaceWithSnapshot, disposeLocalFilePreviews \} = useWriteStore\(\)/)
	assert.match(editPageSource, /useEffect\(\(\) => \{\n\s*return \(\) => \{\n\s*disposeLocalFilePreviews\(\)\n\s*\}\n\s*\}, \[disposeLocalFilePreviews\]\)/)
})
