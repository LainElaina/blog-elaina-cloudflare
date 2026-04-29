import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('manual layout development save persists custom components before reporting success', async () => {
	const source = await fs.readFile(new URL('./layout-save-panel.tsx', import.meta.url), 'utf-8')

	assert.match(source, /await saveLayout\(\)\n\s*const response = await fetch\('\/api\/config'/)
	assert.match(source, /body: JSON\.stringify\(\{ customComponents \}\)/)
	assert.match(source, /if \(!response\.ok\) \{\n\s*throw new Error\('保存自定义组件失败'\)\n\s*\}/)
	assert.match(source, /throw new Error\('保存自定义组件失败'\)[\s\S]*localStorage\.setItem\('custom-components', JSON\.stringify\(customComponents\)\)[\s\S]*toast\.success\('布局和自定义组件已保存'\)/)
})
