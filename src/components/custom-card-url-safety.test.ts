import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('custom card renders only sanitized component URLs', async () => {
	const source = await fs.readFile(new URL('./custom-card.tsx', import.meta.url), 'utf-8')

	assert.match(source, /import \{ isSafeEmbedUrl, isSafeMarkdownImageUrl, isSafeMarkdownLinkUrl \} from '@\/lib\/markdown-url-safety'/)
	assert.match(source, /const imageUrl = type === 'image' && isSafeMarkdownImageUrl\(content\.imageUrl\) \? content\.imageUrl : null/)
	assert.match(source, /const linkUrl = type === 'link' && isSafeMarkdownLinkUrl\(content\.linkUrl\) \? content\.linkUrl : null/)
	assert.match(source, /const iframeUrl = type === 'iframe' && isSafeEmbedUrl\(content\.iframeUrl\) \? content\.iframeUrl : null/)
	assert.match(source, /<a href=\{linkUrl\}/)
	assert.match(source, /<iframe src=\{iframeUrl\} sandbox='allow-scripts'/)
	assert.doesNotMatch(source, /sandbox='[^']*\ballow-same-origin\b/)
	assert.doesNotMatch(source, /sandbox='[^']*\ballow-popups\b/)
	assert.doesNotMatch(source, /sandbox='[^']*\ballow-forms\b/)
	assert.doesNotMatch(source, /href=\{content\.linkUrl\}/)
	assert.doesNotMatch(source, /src=\{content\.iframeUrl\}/)
})
