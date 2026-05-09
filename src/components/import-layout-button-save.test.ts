import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('development layout config import persists project config before reloading', async () => {
	const source = await fs.readFile(new URL('./import-layout-button.tsx', import.meta.url), 'utf-8')

	assert.match(source, /const handleConfirmImport = \(\) => \{\n\s*const input = document\.createElement\('input'\)/)
	assert.match(source, /if \(process\.env\.NODE_ENV === 'development'\) \{\n\s*const response = await fetch\('\/api\/config'/)
	assert.match(source, /body: JSON\.stringify\(\{\n\s*\.\.\.\(sanitizedCardStyles \? \{ cardStyles: sanitizedCardStyles \} : \{\}\),\n\s*\.\.\.\(customComponents \? \{ customComponents \} : \{\}\)\n\s*\}\)/)
	assert.match(source, /if \(!response\.ok\) \{\n\s*throw new Error\('保存布局配置失败'\)\n\s*\}/)
	assert.match(
		source,
		/throw new Error\('保存布局配置失败'\)[\s\S]*localStorage\.setItem\('custom-components', JSON\.stringify\(customComponents\)\)[\s\S]*window\.location\.reload\(\)[\s\S]*toast\.success\('布局配置已导入'\)/
	)
})
