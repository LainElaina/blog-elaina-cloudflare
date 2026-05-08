import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('pushShares result parsing throws instead of hiding invalid artifacts', async () => {
	const source = await fs.readFile(new URL('./push-shares.ts', import.meta.url), 'utf-8')

	assert.match(source, /function parseJsonResult<T>\(content: string\): T \{\n\s*return JSON\.parse\(content\) as T\n\s*\}/)
	assert.match(source, /list: parseJsonResult<Share\[\]>\(artifactContents\.list\)/)
	assert.match(source, /categories: parseJsonResult<ShareCategoriesArtifact>\(artifactContents\.categories\)/)
	assert.match(source, /folders: parseJsonResult<ShareFolderNode\[\]>\(artifactContents\.folders\)/)
	assert.doesNotMatch(source, /parseJsonWithFallback/)
	assert.doesNotMatch(source, /catch \{\n\s*return fallback/)
})
