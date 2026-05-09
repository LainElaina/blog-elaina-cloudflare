import assert from 'node:assert/strict'
import { test } from 'node:test'

import { isSafeMarkdownImageUrl, isSafeMarkdownLinkUrl } from './markdown-url-safety.ts'

test('markdown url safety allows ordinary link and image URLs', () => {
	for (const url of ['https://example.com/a', 'http://example.com/a', '/blogs/post/image.png', './relative.md', '../relative.md', '#section', '//cdn.example.com/a.png']) {
		assert.equal(isSafeMarkdownLinkUrl(url), true)
		assert.equal(isSafeMarkdownImageUrl(url), true)
	}
})

test('markdown url safety keeps write preview blob images but not blob links', () => {
	assert.equal(isSafeMarkdownImageUrl('blob:local-preview'), true)
	assert.equal(isSafeMarkdownLinkUrl('blob:local-preview'), false)
})

test('markdown url safety rejects active or local protocols and obfuscated whitespace', () => {
	for (const url of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<svg>', 'file:///etc/passwd', ' local.png', 'local.png ', 'java\nscript:alert(1)']) {
		assert.equal(isSafeMarkdownLinkUrl(url), false)
		assert.equal(isSafeMarkdownImageUrl(url), false)
	}
})
