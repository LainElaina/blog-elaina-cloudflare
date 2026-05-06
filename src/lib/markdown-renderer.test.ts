import assert from 'node:assert/strict'
import { test } from 'node:test'

import { renderMarkdown } from './markdown-renderer.ts'

test('markdown renderer creates stable non-empty unique heading ids', async () => {
	const result = await renderMarkdown('# Hello\n\n## Hello\n\n### !!!\n\n## !!!')

	assert.deepEqual(
		result.toc.map(item => item.id),
		['hello', 'hello-2', 'section', 'section-2']
	)
	assert.match(result.html, /<h1 id="hello">Hello<\/h1>/)
	assert.match(result.html, /<h2 id="hello-2">Hello<\/h2>/)
	assert.match(result.html, /<h3 id="section">!!!<\/h3>/)
	assert.match(result.html, /<h2 id="section-2">!!!<\/h2>/)
})
