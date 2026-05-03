import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('remote share logo uploads reuse the actual uploaded path for duplicate hashes', async () => {
	const source = (await fs.readFile(new URL('./push-shares.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	assert.match(source, /const uploadedLogoPaths = new Map<string, string>\(\)/)
	assert.match(source, /if \(!uploadedLogoPaths\.has\(hash\)\) \{[\s\S]*?const path = `public\/images\/share\/\$\{filename\}`[\s\S]*?uploadedLogoPaths\.set\(hash, publicPath\)[\s\S]*?\}/)
	assert.match(source, /nextLogoPaths\.set\(url, uploadedLogoPaths\.get\(hash\)!\)/)
	assert.doesNotMatch(source, /uploadedHashes/)
})
