import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import fs from 'node:fs/promises'
import {
	createBlob,
	createCommit,
	createTree,
	getRef,
	GitHubUpdateRefError,
	isGitHubUpdateRefConflictError,
	listRepoFilesRecursive,
	readTextFileFromRepo,
	updateRef
} from './github-client'

async function readSource(relativePath: string) {
	return (await fs.readFile(new URL(relativePath, import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')
}

function findCallContaining(source: string, callee: string, content: string) {
	const contentIndex = source.indexOf(content)
	assert.notEqual(contentIndex, -1)
	const callStart = source.lastIndexOf(`${callee}(`, contentIndex)
	assert.notEqual(callStart, -1)
	const callEnd = source.indexOf('\n\t)', contentIndex)
	assert.notEqual(callEnd, -1)
	return source.slice(callStart, callEnd)
}

const originalFetch = globalThis.fetch

afterEach(() => {
	globalThis.fetch = originalFetch
})

test('createTree resolves a base commit sha to its tree sha before posting', async () => {
	const source = await readSource('./github-client.ts')

	assert.match(
		source,
		/export async function getCommit\(token: string, owner: string, repo: string, commitSha: string\): Promise<\{ sha: string; treeSha: string \}>/
	)
	assert.match(source, /\/git\/commits\/\$\{encodeURIComponent\(commitSha\)\}/)
	assert.match(source, /typeof data\?\.sha !== 'string' \|\| typeof data\?\.tree\?\.sha !== 'string'/)
	assert.match(source, /return \{ sha: data\.sha, treeSha: data\.tree\.sha \}/)
	assert.match(
		source,
		/export async function createTree\(token: string, owner: string, repo: string, tree: TreeItem\[\], baseTreeCommitSha\?: string\): Promise<\{ sha: string \}>/
	)
	assert.match(source, /const baseTree = baseTreeCommitSha \? \(await getCommit\(token, owner, repo, baseTreeCommitSha\)\)\.treeSha : undefined/)
	assert.match(source, /body: JSON\.stringify\(\{ tree, base_tree: baseTree \}\)/)
	assert.doesNotMatch(source, /body: JSON\.stringify\(\{ tree, base_tree: baseTreeCommitSha \}\)/)
})

test('GitHub write helpers reject successful responses without sha', async () => {
	globalThis.fetch = (async () => new Response(JSON.stringify({}), { status: 200 })) as typeof fetch

	await assert.rejects(() => getRef('token', 'owner', 'repo', 'heads/main'), /get ref failed: invalid response/)
	await assert.rejects(() => createTree('token', 'owner', 'repo', []), /create tree failed: invalid response/)
	await assert.rejects(() => createCommit('token', 'owner', 'repo', 'message', 'tree-sha', ['parent-sha']), /create commit failed: invalid response/)
	await assert.rejects(() => createBlob('token', 'owner', 'repo', 'content'), /create blob failed: invalid response/)
})

test('updateRef exposes non-fast-forward 422 errors for publish retries', async () => {
	globalThis.fetch = (async () => new Response(JSON.stringify({ message: 'Reference update failed' }), { status: 422 })) as typeof fetch

	await assert.rejects(
		async () => {
			await updateRef('token', 'owner', 'repo', 'heads/main', 'next-sha')
		},
		error => {
			assert.equal(error instanceof GitHubUpdateRefError, true)
			assert.equal(isGitHubUpdateRefConflictError(error), true)
			assert.match((error as Error).message, /Reference update failed/)
			return true
		}
	)
	const source = await readSource('./github-client.ts')
	assert.match(
		source,
		/if \(res\.status === 422\) \{\n\s*const error = new GitHubUpdateRefError\(res\.status, await readGitHubErrorMessage\(res\)\)\n\s*if \(!isGitHubUpdateRefConflictError\(error\)\) \{\n\s*handle422Error\(\)\n\s*\}\n\s*throw error\n\s*\}/
	)
	assert.doesNotMatch(source, /if \(res\.status === 422\) \{\n\s*handle422Error\(\)/)
})

test('readTextFileFromRepo treats only 404 as missing', async () => {
	globalThis.fetch = (async () => new Response(null, { status: 404 })) as typeof fetch

	assert.equal(await readTextFileFromRepo('token', 'owner', 'repo', 'public/blogs/index.json', 'main'), null)
})

test('readTextFileFromRepo rejects successful directory payloads instead of treating them as missing files', async () => {
	globalThis.fetch = (async () => new Response(JSON.stringify([{ type: 'file', path: 'public/blogs/index.json' }]), { status: 200 })) as typeof fetch

	await assert.rejects(
		() => readTextFileFromRepo('token', 'owner', 'repo', 'public/blogs/index.json', 'main'),
		/read file failed: expected file but received directory/
	)
})

test('readTextFileFromRepo rejects successful file payloads without content', async () => {
	globalThis.fetch = (async () => new Response(JSON.stringify({ type: 'file', path: 'public/blogs/index.json' }), { status: 200 })) as typeof fetch

	await assert.rejects(() => readTextFileFromRepo('token', 'owner', 'repo', 'public/blogs/index.json', 'main'), /read file failed: invalid response/)
})

test('listRepoFilesRecursive treats only 404 as an empty directory', async () => {
	globalThis.fetch = (async () => new Response(null, { status: 404 })) as typeof fetch

	assert.deepEqual(await listRepoFilesRecursive('token', 'owner', 'repo', 'public/blogs/post-a', 'main'), [])
})

test('listRepoFilesRecursive rejects unknown successful payloads instead of returning an empty list', async () => {
	globalThis.fetch = (async () => new Response(JSON.stringify({ message: 'unexpected' }), { status: 200 })) as typeof fetch

	await assert.rejects(() => listRepoFilesRecursive('token', 'owner', 'repo', 'public/blogs/post-a', 'main'), /read directory failed: invalid response/)
})

test('listRepoFilesRecursive rejects directory entries without paths', async () => {
	globalThis.fetch = (async () => new Response(JSON.stringify([{ type: 'file' }]), { status: 200 })) as typeof fetch

	await assert.rejects(() => listRepoFilesRecursive('token', 'owner', 'repo', 'public/blogs/post-a', 'main'), /read directory failed: invalid response/)
})

test('remote save flows read existing artifacts from the captured base commit', async () => {
	const batchDeleteBlogs = await readSource('../app/blog/services/batch-delete-blogs.ts')
	assert.match(batchDeleteBlogs, /const latestCommitSha = refData\.sha[\s\S]*?listRepoFilesRecursive\([^\n]*latestCommitSha\)/)
	assert.match(batchDeleteBlogs, /readTextFileFromRepo\([^\n]*'public\/blogs\/storage\.json', latestCommitSha\)/)
	assert.match(batchDeleteBlogs, /readTextFileFromRepo\([^\n]*'public\/blogs\/index\.json', latestCommitSha\)/)
	assert.doesNotMatch(batchDeleteBlogs, /listRepoFilesRecursive\([^\n]*GITHUB_CONFIG\.BRANCH\)/)
	assert.doesNotMatch(batchDeleteBlogs, /readTextFileFromRepo\([^\n]*GITHUB_CONFIG\.BRANCH\)/)

	const saveBlogEdits = await readSource('../app/blog/services/save-blog-edits.ts')
	assert.match(saveBlogEdits, /readTextFileFromRepo\([^\n]*storagePath, latestCommitSha\)/)
	assert.match(saveBlogEdits, /listRepoFilesRecursive\([^\n]*basePath, latestCommitSha\)/)
	assert.doesNotMatch(saveBlogEdits, /readTextFileFromRepo\([^\n]*storagePath, GITHUB_CONFIG\.BRANCH\)/)
	assert.doesNotMatch(saveBlogEdits, /listRepoFilesRecursive\([^\n]*GITHUB_CONFIG\.BRANCH\)/)

	const bloggerSave = await readSource('../app/bloggers/services/push-bloggers.ts')
	const bloggerListRead = findCallContaining(bloggerSave, 'readTextFileFromRepo', "'src/app/bloggers/list.json'")
	assert.match(bloggerListRead, /latestCommitSha/)
	assert.doesNotMatch(bloggerListRead, /GITHUB_CONFIG\.BRANCH/)

	const projectSave = await readSource('../app/projects/services/push-projects.ts')
	const projectListRead = findCallContaining(projectSave, 'readTextFileFromRepo', "'src/app/projects/list.json'")
	assert.match(projectListRead, /latestCommitSha/)
	assert.doesNotMatch(projectListRead, /GITHUB_CONFIG\.BRANCH/)

	const pictureSave = await readSource('../app/pictures/services/push-pictures.ts')
	const pictureListRead = findCallContaining(pictureSave, 'readTextFileFromRepo', "'src/app/pictures/list.json'")
	assert.match(pictureListRead, /latestCommitSha/)
	assert.doesNotMatch(pictureListRead, /GITHUB_CONFIG\.BRANCH/)

	const shareSave = await readSource('../app/share/services/push-shares.ts')
	assert.match(shareSave, /readTextFileFromRepo\([^\n]*'public\/share\/storage\.json', latestCommitSha\)/)
	assert.doesNotMatch(shareSave, /readTextFileFromRepo\([^\n]*'public\/share\/storage\.json', GITHUB_CONFIG\.BRANCH\)/)

	const deleteBlog = await readSource('../app/write/services/delete-blog.ts')
	assert.match(deleteBlog, /listRepoFilesRecursive\([^\n]*basePath, latestCommitSha\)/)
	assert.match(deleteBlog, /readTextFileFromRepo\([^\n]*'public\/blogs\/storage\.json', latestCommitSha\)/)
	assert.match(deleteBlog, /readTextFileFromRepo\([^\n]*'public\/blogs\/index\.json', latestCommitSha\)/)
	assert.doesNotMatch(deleteBlog, /listRepoFilesRecursive\([^\n]*GITHUB_CONFIG\.BRANCH\)/)
	assert.doesNotMatch(deleteBlog, /readTextFileFromRepo\([^\n]*GITHUB_CONFIG\.BRANCH\)/)

	const pushBlog = await readSource('../app/write/services/push-blog.ts')
	assert.match(pushBlog, /readTextFileFromRepo\([^\n]*'public\/blogs\/storage\.json', latestCommitSha\)/)
	assert.match(pushBlog, /readTextFileFromRepo\([^\n]*'public\/blogs\/index\.json', latestCommitSha\)/)
	assert.doesNotMatch(pushBlog, /readTextFileFromRepo\([^\n]*GITHUB_CONFIG\.BRANCH\)/)
})
