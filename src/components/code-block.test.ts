import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const componentSource = readFileSync(new URL('./code-block.tsx', import.meta.url), 'utf8')
const articleStyles = readFileSync(new URL('../styles/article.css', import.meta.url), 'utf8')

test('code block component exposes long-line reading controls', () => {
	assert.match(componentSource, /code-block-actions/)
	assert.match(componentSource, /code-block-wrapper--wrapped/)
	assert.match(componentSource, /code-block-wrapper--fullscreen/)
	assert.match(componentSource, /code-block-fullscreen-overlay/)
	assert.match(componentSource, /createPortal/)
	assert.match(componentSource, /document\.body/)
	assert.match(componentSource, /开启代码自动换行/)
	assert.match(componentSource, /全屏查看代码/)
	assert.match(componentSource, /关闭全屏查看代码/)
})

test('article styles define wrapped and fullscreen code block modes', () => {
	assert.match(articleStyles, /code-block-wrapper--wrapped/)
	assert.match(articleStyles, /white-space:\s*pre-wrap/)
	assert.match(articleStyles, /code-block-wrapper--fullscreen/)
	assert.match(articleStyles, /code-block-fullscreen-overlay/)
	assert.match(articleStyles, /\.code-block-fullscreen-overlay\s*\{[\s\S]*position:\s*fixed/)
	assert.match(articleStyles, /\.code-block-fullscreen-overlay\s*\{[\s\S]*inset:\s*0/)
})
