import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('remote share logo uploads reuse the actual uploaded path for duplicate filenames', async () => {
	const source = (await fs.readFile(new URL('./push-shares.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	assert.match(source, /const uploadedLogoPaths = new Map<string, string>\(\)/)
	assert.match(source, /const publicPath = `\/images\/share\/\$\{filename\}`\n\s*const uploadKey = filename/)
	assert.match(source, /if \(!uploadedLogoPaths\.has\(uploadKey\)\) \{[\s\S]*?uploadedLogoPaths\.set\(uploadKey, publicPath\)[\s\S]*?\}/)
	assert.match(source, /nextLogoPaths\.set\(url, uploadedLogoPaths\.get\(uploadKey\)!\)/)
	assert.doesNotMatch(source, /uploadedHashes/)
})
