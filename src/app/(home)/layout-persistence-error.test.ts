import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('layout store propagates server persistence failures to callers', async () => {
	const source = await fs.readFile(new URL('./stores/config-store.ts', import.meta.url), 'utf-8')

	assert.match(source, /saveLayout: async \(\) => \{\n\s*const \{ cardStyles \} = get\(\)\n\s*await saveLayoutToServer\(cardStyles\)\n\s*\}/)
	assert.match(source, /undoLayout: async \(\) => \{\n\s*await undoLayout\(\)\n\s*\/\/ 重新加载页面以应用撤销的布局\n\s*window\.location\.reload\(\)\n\s*\}/)
	assert.doesNotMatch(source, /console\.error\('Failed to save layout:'\)/)
	assert.doesNotMatch(source, /console\.error\('Failed to undo layout:'\)/)
})

test('layout import awaits development save before reporting success', async () => {
	const source = await fs.readFile(new URL('./config-dialog/layout-manager.tsx', import.meta.url), 'utf-8')

	assert.match(source, /const handleImport = async \(\) => \{/)
	assert.match(source, /if \(isDev\) \{\n\s*await saveLayout\(\)\n\s*toast\.success\('布局已导入并保存'\)/)
	assert.match(source, /error instanceof SyntaxError/)
	assert.match(source, /toast\.error\('保存失败'\)/)
})
