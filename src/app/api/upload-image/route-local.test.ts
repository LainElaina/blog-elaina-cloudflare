import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('upload image local route writes uploaded image atomically', async () => {
	const source = await fs.readFile(new URL('./route-local.ts', import.meta.url), 'utf-8')

	assert.match(source, /import \{ mkdir, rename, rm, writeFile \} from 'fs\/promises'/)
	assert.match(source, /function buildAtomicUploadTempPath\(fullPath: string\)/)
	assert.match(source, /async function writeImageAtomically\(fullPath: string, buffer: Buffer\)/)
	assert.match(source, /await writeFile\(tempPath, buffer\)\n\t\tawait rename\(tempPath, fullPath\)/)
	assert.match(source, /await rm\(tempPath, \{ force: true \}\)\.catch\(\(\) => undefined\)/)
	assert.match(source, /await writeImageAtomically\(fullPath, buffer\)/)
	assert.doesNotMatch(source, /await writeFile\(fullPath, buffer\)/)
})
