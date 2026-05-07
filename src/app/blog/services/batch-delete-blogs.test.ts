import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { describe, it } from 'node:test'

describe('batchDeleteBlogs remote update retry', () => {
	it('远端批量删除遇到分支更新冲突时应重新执行完整删除流程', async () => {
		const source = (await fs.readFile(new URL('./batch-delete-blogs.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

		assert.match(source, /async function attemptBatchDeleteBlogs\(\)/)
		assert.match(source, /if \(isGitHubUpdateRefConflictError\(error\)\) \{\n\s*toast\.info\('分支已更新，正在重新删除\.\.\.'\)\n\s*await attemptBatchDeleteBlogs\(\)/)
		assert.match(source, /const refData = await getRef[\s\S]*?for \(const slug of uniqueSlugs\)[\s\S]*?const artifactContents = await buildBatchDeleteArtifactContents[\s\S]*?await updateRef\(token, GITHUB_CONFIG\.OWNER, GITHUB_CONFIG\.REPO, `heads\/\$\{GITHUB_CONFIG\.BRANCH\}`, commitData\.sha\)/)
	})
})
