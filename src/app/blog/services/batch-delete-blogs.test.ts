import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { describe, it } from 'node:test'

describe('batchDeleteBlogs remote stale write protection', () => {
	it('远端批量删除遇到分支更新冲突时应阻断旧状态覆盖', async () => {
		const source = (await fs.readFile(new URL('./batch-delete-blogs.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

		assert.match(source, /async function attemptBatchDeleteBlogs\(\)/)
		assert.match(source, /catch \(error\) \{\n\s*throwStaleRemoteWriteConflictError\(error\)/)
		assert.doesNotMatch(source, /isGitHubUpdateRefConflictError/)
		assert.doesNotMatch(source, /catch \(error\) \{[\s\S]*await attemptBatchDeleteBlogs\(\)/)
		assert.match(source, /const refData = await getRef[\s\S]*?for \(const slug of uniqueSlugs\)[\s\S]*?const artifactContents = await buildBatchDeleteArtifactContents[\s\S]*?await updateRef\(token, GITHUB_CONFIG\.OWNER, GITHUB_CONFIG\.REPO, `heads\/\$\{GITHUB_CONFIG\.BRANCH\}`, commitData\.sha\)/)
	})
})
