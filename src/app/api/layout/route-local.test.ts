import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

import { handleLayoutPost } from './route-local.ts'

test('layout local route saves layout and backup atomically', async () => {
	const source = await fs.readFile(new URL('./route-local.ts', import.meta.url), 'utf-8')

	assert.match(source, /function buildAtomicLayoutTempPath\(fullPath: string\)/)
	assert.match(source, /function writeFileAtomically\(fullPath: string, content: string\)/)
	assert.match(source, /fs\.writeFileSync\(tempPath, content, 'utf-8'\)\n\t\tfs\.renameSync\(tempPath, fullPath\)/)
	assert.match(source, /fs\.rmSync\(tempPath, \{ force: true \}\)/)
	assert.match(source, /writeFileAtomically\(BACKUP_PATH, current\)/)
	assert.match(source, /writeFileAtomically\(LAYOUT_PATH, JSON\.stringify\(layout, null, '\\t'\)\)/)
	assert.doesNotMatch(source, /fs\.writeFileSync\(BACKUP_PATH, current\)/)
	assert.doesNotMatch(source, /fs\.writeFileSync\(LAYOUT_PATH, JSON\.stringify\(layout, null, '\\t'\)\)/)
})

test('layout local route returns 400 when JSON body is malformed', async () => {
	const response = await handleLayoutPost({
		json: async () => {
			throw new SyntaxError('bad json')
		}
	} as any)

	assert.equal(response.status, 400)
	assert.deepEqual(await response.json(), { error: '请求体格式错误' })
})
