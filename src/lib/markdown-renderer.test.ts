import assert from 'node:assert/strict'
import { test } from 'node:test'

import { marked } from 'marked'

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

test('markdown renderer isolates concurrent code block placeholders', async () => {
	const [alpha, beta] = await Promise.all([
		renderMarkdown('```js\nconst alphaOnly = 1\n```'),
		renderMarkdown('```js\nconst betaOnly = 2\n```')
	])

	assert.doesNotMatch(alpha.html, /__SHIKI_CODE_/)
	assert.doesNotMatch(beta.html, /__SHIKI_CODE_/)
	assert.match(alpha.html, /alphaOnly/)
	assert.doesNotMatch(alpha.html, /betaOnly/)
	assert.match(beta.html, /betaOnly/)
	assert.doesNotMatch(beta.html, /alphaOnly/)
})

test('markdown renderer prepares nested fenced code blocks', async () => {
	const result = await renderMarkdown('> ```js\n> const nestedOnly = 3\n> ```')

	assert.doesNotMatch(result.html, /__SHIKI_CODE_/)
	assert.match(result.html, /nestedOnly/)
	assert.match(result.html, /data-code="const nestedOnly = 3"/)
})

test('markdown renderer does not mutate the global marked singleton', async () => {
	assert.equal(marked.parse('$x$'), '<p>$x$</p>\n')

	await renderMarkdown('$x$')

	assert.equal(marked.parse('$x$'), '<p>$x$</p>\n')
})
