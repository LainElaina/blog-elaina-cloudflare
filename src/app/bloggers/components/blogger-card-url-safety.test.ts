import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('blogger card renders only sanitized avatar and link URLs', async () => {
	const source = await fs.readFile(new URL('./blogger-card.tsx', import.meta.url), 'utf-8')

	assert.match(source, /import \{ isSafeMarkdownImageUrl, isSafeMarkdownLinkUrl \} from '@\/lib\/markdown-url-safety'/)
	assert.match(source, /const avatarUrl = isSafeMarkdownImageUrl\(localBlogger\.avatar\) \? localBlogger\.avatar : null/)
	assert.match(source, /const bloggerUrl = isSafeMarkdownLinkUrl\(localBlogger\.url\) \? localBlogger\.url : null/)
	assert.match(source, /\{avatarUrl && \(/)
	assert.match(source, /src=\{avatarUrl\}/)
	assert.match(source, /bloggerUrl && \(/)
	assert.match(source, /href=\{bloggerUrl\}/)
	assert.doesNotMatch(source, /src=\{localBlogger\.avatar\}/)
	assert.doesNotMatch(source, /href=\{localBlogger\.url\}/)
})
