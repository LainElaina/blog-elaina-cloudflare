import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('social buttons render only sanitized external and QR URLs', async () => {
	const source = await fs.readFile(new URL('./social-buttons.tsx', import.meta.url), 'utf-8')

	assert.match(source, /import \{ isSafeMarkdownImageUrl, isSafeMarkdownLinkUrl \} from '@\/lib\/markdown-url-safety'/)
	assert.match(source, /const linkUrl = isSafeMarkdownLinkUrl\(button\.value\) \? button\.value : null/)
	assert.match(source, /const qrImageUrl = imageUrl\?\.startsWith\('\/images\/social-buttons\/'\) \? imageUrl : null/)
	assert.match(source, /href=\{linkUrl\}/)
	assert.match(source, /rel='noopener noreferrer'/)
	assert.match(source, /<img src=\{qrImageUrl\} alt='QR Code'/)
	assert.doesNotMatch(source, /href=\{button\.value\}/)
	assert.doesNotMatch(source, /<img src=\{button\.value\} alt='QR Code'/)
})
