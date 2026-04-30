import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('pushShares result parsing falls back to built artifacts', async () => {
	const source = await fs.readFile(new URL('./push-shares.ts', import.meta.url), 'utf-8')

	assert.match(source, /function parseJsonWithFallback<T>\(content: string \| undefined, fallback: T\): T \{\n\s*if \(!content\) return fallback\n\n\s*try \{\n\s*return JSON\.parse\(content\) as T\n\s*\} catch \{\n\s*return fallback/)
	assert.match(source, /list: parseJsonWithFallback<Share\[\]>\(artifactContents\.list, updatedShares\)/)
	assert.match(source, /categories: parseJsonWithFallback<ShareCategoriesArtifact>\(artifactContents\.categories, \{ categories: \[\] \}\)/)
	assert.match(source, /folders: parseJsonWithFallback<ShareFolderNode\[\]>\(artifactContents\.folders, \[\]\)/)
	assert.doesNotMatch(source, /listPayload \? \(JSON\.parse\(listPayload\.content\) as Share\[\]\) : updatedShares/)
})
