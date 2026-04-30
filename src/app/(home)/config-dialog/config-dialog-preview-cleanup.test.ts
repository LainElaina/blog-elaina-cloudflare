import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('config dialog keeps pending preview cleanup tied to replacement or final close', async () => {
	const source = (await fs.readFile(new URL('./index.tsx', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	assert.match(source, /import \{ revokeFilePreviewUrls, revokeUnusedFilePreviewUrls \} from '@\/lib\/upload-preview-url'/)
	assert.match(source, /const pendingAssetUploadsRef = useRef<PendingAssetUploadsState>\(createEmptyPendingAssetUploads\(\)\)/)
	assert.match(source, /const revokePendingAssetUploads = useCallback\(\(\) => \{\n\s*revokeFilePreviewUrls\(getPendingAssetUploads\(\)\)\n\s*pendingAssetUploadsRef\.current = createEmptyPendingAssetUploads\(\)/)
	assert.match(source, /useEffect\(\(\) => \{\n\s*return \(\) => \{\n\s*revokePendingAssetUploads\(\)\n\s*\}\n\s*\}, \[revokePendingAssetUploads\]\)/)
	assert.doesNotMatch(source, /\}, \[faviconItem, avatarItem, artImageUploads, backgroundImageUploads, socialButtonImageUploads\]\)/)
	assert.doesNotMatch(source, /URL\.revokeObjectURL/)
})

test('config dialog revokes only replaced pending previews in wrapped setters', async () => {
	const source = (await fs.readFile(new URL('./index.tsx', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	const setters = [
		['setFaviconItemWithPreviewCleanup', 'faviconItem', 'setFaviconItem'],
		['setAvatarItemWithPreviewCleanup', 'avatarItem', 'setAvatarItem'],
		['setArtImageUploadsWithPreviewCleanup', 'artImageUploads', 'setArtImageUploads'],
		['setBackgroundImageUploadsWithPreviewCleanup', 'backgroundImageUploads', 'setBackgroundImageUploads'],
		['setSocialButtonImageUploadsWithPreviewCleanup', 'socialButtonImageUploads', 'setSocialButtonImageUploads']
	] as const

	for (const [wrapperName, stateKey, stateSetter] of setters) {
		assert.match(source, new RegExp(`const ${wrapperName} = useCallback\\(\\(action: SetStateAction<`), wrapperName)
		assert.match(source, new RegExp(`const previous = pendingAssetUploadsRef\\.current\\.${stateKey}[\\s\\S]*const next = resolveStateAction\\(action, previous\\)[\\s\\S]*revokeUnusedFilePreviewUrls`), wrapperName)
		assert.match(source, new RegExp(`pendingAssetUploadsRef\\.current\\.${stateKey} = next[\\s\\S]*${stateSetter}\\(next\\)`), wrapperName)
		assert.match(source, new RegExp(`${stateSetter.replace(/[()]/g, '\\$&')}=\\{${wrapperName}\\}`), wrapperName)
	}
})

test('config dialog clears pending previews only after save, publish, or cancel', async () => {
	const source = (await fs.readFile(new URL('./index.tsx', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	assert.match(source, /const clearPendingAssetUploads = useCallback\(\(\) => \{\n\s*revokePendingAssetUploads\(\)\n\s*setFaviconItem\(null\)/)
	assert.match(source, /await pushSiteContent\([\s\S]*?\)\n\s*setSiteContent\(formData\)[\s\S]*?clearPendingAssetUploads\(\)\n\s*onClose\(\)/)
	assert.match(source, /if \(shouldClearLocalPendingAssetUploads\(action\)\) \{\n\s*clearPendingAssetUploads\(\)\n\s*\}/)
	assert.match(source, /const handleCancel = \(\) => \{\n\s*clearPendingAssetUploads\(\)/)
	assert.doesNotMatch(source, /if \(action === 'draft'\) \{[\s\S]*?clearPendingAssetUploads\(\)/)
})
