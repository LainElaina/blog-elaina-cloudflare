import assert from 'node:assert/strict'
import { test } from 'node:test'

import { extractMarkdownCodeBlocks } from './markdown-code-block-extraction.ts'

test('markdown code block extraction preserves nested shiki pre elements', () => {
	const html = '<p>before</p><pre data-code="const value = 1"><pre class="shiki"><code>const value = 1</code></pre></pre><p>after</p>'
	const { processedHtml, codeBlocks } = extractMarkdownCodeBlocks(html)

	assert.equal(processedHtml, '<p>before</p>__CODE_BLOCK_0__<p>after</p>')
	assert.equal(codeBlocks.length, 1)
	assert.equal(codeBlocks[0].code, 'const value = 1')
	assert.equal(codeBlocks[0].preHtml, '<pre class="shiki"><code>const value = 1</code></pre>')
})

test('markdown code block extraction decodes copied code without touching rendered html', () => {
	const html = '<pre data-code="&lt;tag data-value=&quot;1&quot;&gt;&amp;&#39;"><code>&lt;tag&gt;</code></pre>'
	const { processedHtml, codeBlocks } = extractMarkdownCodeBlocks(html)

	assert.equal(processedHtml, '__CODE_BLOCK_0__')
	assert.equal(codeBlocks[0].code, '<tag data-value="1">&\'')
	assert.equal(codeBlocks[0].preHtml, '<code>&lt;tag&gt;</code>')
})
