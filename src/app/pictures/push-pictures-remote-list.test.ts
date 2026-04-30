import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('remote pictures publish blocks when previous list cannot be parsed', async () => {
	const source = await fs.readFile(new URL('./services/push-pictures.ts', import.meta.url), 'utf-8')

	assert.match(source, /catch \(error\) \{\n\s*console\.error\('Failed to parse previous list\.json:', error\)\n\s*throw new Error\('远程图床列表解析失败，请修复 src\/app\/pictures\/list\.json 后重试'\)/)
	assert.doesNotMatch(source, /catch \(error\) \{\n\s*console\.error\('Failed to parse previous list\.json:', error\)\n\s*\}\n\s*\}/)
})
