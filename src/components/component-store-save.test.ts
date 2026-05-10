import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('component store local save checks config response before reporting success', async () => {
	const source = await fs.readFile(new URL('./component-store.tsx', import.meta.url), 'utf-8')

	assert.match(source, /const safeCustomComponents = normalizeCustomComponents\(customComponents\)/)
	assert.match(source, /const componentsJson = JSON\.stringify\(safeCustomComponents, null, '\\t'\)/)
	assert.match(source, /const response = await fetch\('\/api\/config'/)
	assert.match(source, /body: JSON\.stringify\(\{ customComponents: safeCustomComponents \}\)/)
	assert.match(source, /const referencedImageUrls = new Set\(safeCustomComponents\.map\(component => component\.content\.imageUrl\)\.filter\(\(imageUrl\): imageUrl is string => Boolean\(imageUrl\)\)\)/)
	assert.match(source, /if \(!response\.ok\) \{/)
	assert.match(source, /throw new Error\('保存自定义组件失败'\)/)
	assert.match(source, /toast\.success\('自定义组件已保存到项目'\)/)
})
