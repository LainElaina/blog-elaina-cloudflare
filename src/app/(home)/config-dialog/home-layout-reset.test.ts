import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('home layout builtin reset updates visible state only after persistence succeeds', async () => {
	const source = await fs.readFile(new URL('./home-layout.tsx', import.meta.url), 'utf-8')

	assert.match(
		source,
		/const handleResetBuiltin = async \(\) => \{\n\s*if \(!confirm\('确定重置所有内置组件的位置和大小为默认值？'\)\) return\n\s*const defaults = cardStylesDefault as CardStyles\n\s*try \{\n\s*await persistToProject\(defaults, customComponents\)\n\s*setCardStylesData\(defaults\)\n\s*setCardStyles\(defaults\)/
	)
})

test('home layout full reset clears custom components only after persistence succeeds', async () => {
	const source = await fs.readFile(new URL('./home-layout.tsx', import.meta.url), 'utf-8')

	assert.match(
		source,
		/const handleResetAll = async \(\) => \{\n\s*if \(!confirm\('确定重置全部？这将清空所有自定义组件，并将内置组件的位置、大小和显示状态全部恢复为默认值。'\)\) return\n\s*const defaults = cardStylesDefault as CardStyles\n\s*try \{\n\s*await persistToProject\(defaults, \[\]\)\n\s*setCardStylesData\(defaults\)\n\s*setCardStyles\(defaults\)\n\s*useCustomComponentStore\.setState\(\{ components: \[\] \}\)\n\s*if \(typeof window !== 'undefined'\) \{\n\s*localStorage\.setItem\('custom-components', JSON\.stringify\(\[\]\)\)/
	)
})
