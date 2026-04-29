import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('custom component store treats persisted empty array as intentional state', async () => {
	const source = await fs.readFile(new URL('./custom-component-store.ts', import.meta.url), 'utf-8')

	assert.match(source, /if \(Array\.isArray\(parsed\)\) return parsed/)
	assert.doesNotMatch(source, /Array\.isArray\(parsed\) && parsed\.length > 0/)
	assert.doesNotMatch(source, /空数组，说明用户执行过"重置全部"但未持久化，应回退到项目文件/)
})
