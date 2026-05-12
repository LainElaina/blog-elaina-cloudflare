import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
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

test('markdown renderer escapes malformed raw html tags with slash-separated attributes', async () => {
	const result = await renderMarkdown('<img/src=x onerror=alert(1)> <svg/onload=alert(1)>')

	assert.doesNotMatch(result.html, /<img/i)
	assert.doesNotMatch(result.html, /<svg/i)
	assert.match(result.html, /&lt;img\/src=x onerror=alert\(1\)&gt;/)
	assert.match(result.html, /&lt;svg\/onload=alert\(1\)&gt;/)
})

test('markdown renderer escapes iframe and nested raw html inside allowed tags', async () => {
	const result = await renderMarkdown('<iframe src="javascript:alert(1)"></iframe> <u><img src=x onerror=alert(1)></u>')

	assert.match(result.html, /&lt;iframe src=&quot;javascript:alert\(1\)&quot;&gt;&lt;\/iframe&gt;/)
	assert.match(result.html, /<u>&lt;img src=x onerror=alert\(1\)&gt;<\/u>/)
	assert.doesNotMatch(result.html, /<iframe/i)
	assert.doesNotMatch(result.html, /<img/i)
})

test('markdown renderer sanitizes raw html inside headings while preserving markdown formatting', async () => {
	const result = await renderMarkdown('# **标题** <script>alert(1)</script> <u>重点</u>')

	assert.match(result.html, /<h1 id="标题-alert1-重点"><strong>标题<\/strong> &lt;script&gt;alert\(1\)&lt;\/script&gt; <u>重点<\/u><\/h1>/)
	assert.doesNotMatch(result.html, /<script>/)
	assert.deepEqual(result.toc, [{ id: '标题-alert1-重点', text: '**标题** <script>alert(1)</script> <u>重点</u>', level: 1 }])
})

test('markdown renderer does not emit unsafe KaTeX href URLs', async () => {
	const result = await renderMarkdown('$\\href{javascript:alert(1)}{unsafe}$')

	assert.doesNotMatch(result.html, /href=["']javascript:/i)
	assert.doesNotMatch(result.html, /javascript:alert/i)
})

test('markdown renderer escapes math fallback content', async () => {
	const source = await readFile(new URL('./markdown-renderer.ts', import.meta.url), 'utf-8')

	assert.match(source, /escapeHtml\(content\)/)
	assert.doesNotMatch(source, /`\$\$\$\{content\}\$\$`/)
	assert.doesNotMatch(source, /`\$\$\{content\}\$`/)
})

test('markdown renderer filters unsafe link and image protocols', async () => {
	const result = await renderMarkdown('[safe](https://example.com) [bad](javascript:alert(1)) ![ok](/blogs/post/a.png) ![bad image](file:///etc/passwd) ![preview](blob:local-preview)')

	assert.match(result.html, /<a href="https:\/\/example\.com">safe<\/a>/)
	assert.match(result.html, /safe/)
	assert.match(result.html, /bad/)
	assert.doesNotMatch(result.html, /href="javascript:/)
	assert.match(result.html, /<img src="\/blogs\/post\/a\.png" alt="ok">/)
	assert.match(result.html, /<img src="blob:local-preview" alt="preview">/)
	assert.doesNotMatch(result.html, /src="file:/)
})
