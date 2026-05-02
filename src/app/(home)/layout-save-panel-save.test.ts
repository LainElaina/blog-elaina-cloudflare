import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('manual layout development save persists layout and custom components in one request before reporting success', async () => {
	const source = await fs.readFile(new URL('./layout-save-panel.tsx', import.meta.url), 'utf-8')

	assert.doesNotMatch(source, /await saveLayout\(\)\n\s*const response = await fetch\('\/api\/config'/)
	assert.match(source, /body: JSON\.stringify\(\{ cardStyles, customComponents \}\)/)
	assert.match(source, /if \(!response\.ok\) \{\n\s*throw new Error\('保存布局和自定义组件失败'\)\n\s*\}/)
	assert.match(source, /throw new Error\('保存布局和自定义组件失败'\)[\s\S]*localStorage\.setItem\('layout-snapshots', JSON\.stringify\(\[newSnapshot, \.\.\.snapshots\]\)\)[\s\S]*localStorage\.setItem\('custom-components', JSON\.stringify\(customComponents\)\)[\s\S]*toast\.success\('布局和自定义组件已保存'\)/)
})

test('manual layout save records snapshots only after durable persistence succeeds', async () => {
	const source = await fs.readFile(new URL('./layout-save-panel.tsx', import.meta.url), 'utf-8')
	const firstSnapshotWriteIndex = source.indexOf("localStorage.setItem('layout-snapshots', JSON.stringify([newSnapshot, ...snapshots]))")
	const configResponseCheckIndex = source.indexOf("throw new Error('保存布局和自定义组件失败')")

	assert.notEqual(firstSnapshotWriteIndex, -1)
	assert.notEqual(configResponseCheckIndex, -1)
	assert.ok(configResponseCheckIndex < firstSnapshotWriteIndex)
})

test('manual layout save ignores corrupted local snapshot history', async () => {
	const source = await fs.readFile(new URL('./layout-save-panel.tsx', import.meta.url), 'utf-8')

	assert.match(source, /function readLayoutSnapshots\(\): unknown\[\] \{\n\s*try \{\n\s*const saved = localStorage\.getItem\('layout-snapshots'\)/)
	assert.match(source, /const parsed = JSON\.parse\(saved\)\n\s*return Array\.isArray\(parsed\) \? parsed : \[\]\n\s*\} catch \{\n\s*return \[\]/)
	assert.match(source, /const snapshots = readLayoutSnapshots\(\)\n\s*const newSnapshot = \{[\s\S]*localStorage\.setItem\('layout-snapshots', JSON\.stringify\(\[newSnapshot, \.\.\.snapshots\]\)\)/)
	assert.doesNotMatch(source, /JSON\.parse\(localStorage\.getItem\('layout-snapshots'\) \|\| '\[\]'\)/)
})
