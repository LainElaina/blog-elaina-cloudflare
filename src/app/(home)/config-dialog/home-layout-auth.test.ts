import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('home layout reset rejects unauthenticated production persistence before mutating state', async () => {
	const source = await fs.readFile(new URL('./home-layout.tsx', import.meta.url), 'utf-8')

	assert.match(
		source,
		/} else \{\n\s*toast\.error\('线上环境需要先导入密钥才能持久化保存'\)\n\s*addLog\('error', 'layout', '重置未能持久化：未导入密钥'\)\n\s*throw new Error\('线上环境需要先导入密钥才能持久化保存'\)\n\s*\}/
	)
	assert.doesNotMatch(source, /重置未能持久化：未导入密钥'[\s\S]*\n\s*return\n/)
})
