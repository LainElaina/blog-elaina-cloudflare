import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('pushSiteContent remote uploads validate image content before creating blobs', async () => {
	const source = await fs.readFile(new URL('./push-site-content.ts', import.meta.url), 'utf-8')

	assert.match(source, /import \{ assertAllowedImageFile, getImageFileExtension \} from '@\/lib\/image-content-validation'/)
	assert.match(source, /async function appendImageFileTreeItem\(token: string, treeItems: TreeItem\[], path: string, file: File\) \{\n\s*await assertAllowedImageFile\(file, getImageFileExtension\(file\.name\)\)\n\s*const contentBase64 = await fileToBase64NoPrefix\(file\)\n\s*const blobData = await createBlob/)
	assert.match(source, /await appendImageFileTreeItem\(token, treeItems, 'public\/favicon\.png', faviconItem\.file\)/)
	assert.match(source, /await appendImageFileTreeItem\(token, treeItems, 'public\/images\/avatar\.png', avatarItem\.file\)/)
	assert.match(source, /await appendImageFileTreeItem\(token, treeItems, path, item\.file\)/)
	assert.doesNotMatch(source, /fileToBase64NoPrefix\((?:faviconItem|avatarItem|item)\.file\)/)
})
