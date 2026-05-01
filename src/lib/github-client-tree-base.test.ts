import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('createTree resolves a base commit sha to its tree sha before posting', async () => {
	const source = (await fs.readFile(new URL('./github-client.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	assert.match(source, /export async function getCommit\(token: string, owner: string, repo: string, commitSha: string\): Promise<\{ sha: string; treeSha: string \}>/)
	assert.match(source, /\/git\/commits\/\$\{encodeURIComponent\(commitSha\)\}/)
	assert.match(source, /typeof data\?\.sha !== 'string' \|\| typeof data\?\.tree\?\.sha !== 'string'/)
	assert.match(source, /return \{ sha: data\.sha, treeSha: data\.tree\.sha \}/)
	assert.match(source, /export async function createTree\(token: string, owner: string, repo: string, tree: TreeItem\[\], baseTreeCommitSha\?: string\): Promise<\{ sha: string \}>/)
	assert.match(source, /const baseTree = baseTreeCommitSha \? \(await getCommit\(token, owner, repo, baseTreeCommitSha\)\)\.treeSha : undefined/)
	assert.match(source, /body: JSON\.stringify\(\{ tree, base_tree: baseTree \}\)/)
	assert.doesNotMatch(source, /body: JSON\.stringify\(\{ tree, base_tree: baseTreeCommitSha \}\)/)
})
