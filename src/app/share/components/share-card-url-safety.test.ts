import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('share card renders only sanitized logo and link URLs', async () => {
	const source = await fs.readFile(new URL('./share-card.tsx', import.meta.url), 'utf-8')

	assert.match(source, /import \{ isSafeMarkdownImageUrl, isSafeMarkdownLinkUrl \} from '@\/lib\/markdown-url-safety'/)
	assert.match(source, /const logoUrl = isSafeMarkdownImageUrl\(localShare\.logo\) \? localShare\.logo : null/)
	assert.match(source, /const shareUrl = isSafeMarkdownLinkUrl\(localShare\.url\) \? localShare\.url : null/)
	assert.match(source, /\{logoUrl && \(/)
	assert.match(source, /src=\{logoUrl\}/)
	assert.match(source, /shareUrl && \(/)
	assert.match(source, /href=\{shareUrl\}/)
	assert.doesNotMatch(source, /src=\{localShare\.logo\}/)
	assert.doesNotMatch(source, /href=\{localShare\.url\}/)
})
