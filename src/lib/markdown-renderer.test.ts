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

test('markdown renderer keeps only safe raw html tags used by existing content', async () => {
	const result = await renderMarkdown('保留 <u>重点</u>，转义 <script>alert(1)</script> 和 <u onclick="alert(1)">坏属性</u>。')

	assert.match(result.html, /<u>重点<\/u>/)
	assert.doesNotMatch(result.html, /<script>/)
	assert.doesNotMatch(result.html, /<u onclick=/)
	assert.match(result.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
	assert.match(result.html, /&lt;u onclick=&quot;alert\(1\)&quot;&gt;坏属性<\/u>/)
})

test('markdown renderer sanitizes raw html inside headings while preserving markdown formatting', async () => {
	const result = await renderMarkdown('# **标题** <script>alert(1)</script> <u>重点</u>')

	assert.match(result.html, /<h1 id="标题-alert1-重点"><strong>标题<\/strong> &lt;script&gt;alert\(1\)&lt;\/script&gt; <u>重点<\/u><\/h1>/)
	assert.doesNotMatch(result.html, /<script>/)
	assert.deepEqual(result.toc, [{ id: '标题-alert1-重点', text: '**标题** <script>alert(1)</script> <u>重点</u>', level: 1 }])
})
