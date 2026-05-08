import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import fs from 'node:fs/promises'
import { registerHooks } from 'node:module'

registerHooks({
	resolve(specifier, context, nextResolve) {
		if (specifier === '@/hooks/use-auth') {
			return {
				shortCircuit: true,
				url: 'data:text/javascript,export const useAuthStore = { getState: () => ({ clearAuth: () => undefined }) }'
			}
		}
		return nextResolve(specifier, context)
	}
})

const {
	createBlob,
	createCommit,
	createTree,
	getRef,
	GH_API,
	GitHubUpdateRefError,
	isGitHubUpdateRefConflictError,
	listRepoFilesRecursive,
	putFile,
	readTextFileFromRepo,
	updateRef
} = await import('./github-client.ts')

async function readSource(relativePath: string) {
	return (await fs.readFile(new URL(relativePath, import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')
}

function findCallContaining(source: string, callee: string, content: string) {
	const contentIndex = source.indexOf(content)
	assert.notEqual(contentIndex, -1)
	const callStart = source.lastIndexOf(`${callee}(`, contentIndex)
	assert.notEqual(callStart, -1)

	let depth = 0
	for (let index = callStart + callee.length; index < source.length; index++) {
		if (source[index] === '(') {
			depth++
		} else if (source[index] === ')') {
			depth--
			if (depth === 0) {
				return source.slice(callStart, index + 1)
			}
		}
	}

	assert.fail(`Could not find end of ${callee} call`)
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

test('GitHub write helpers include API error messages in failures', async () => {
	globalThis.fetch = (async () => new Response(JSON.stringify({ message: 'Validation failed' }), { status: 500 })) as typeof fetch

	await assert.rejects(() => createBlob('token', 'owner', 'repo', 'content'), /create blob failed: 500 Validation failed/)
})

test('readTextFileFromRepo includes API error messages in failures', async () => {
	globalThis.fetch = (async () => new Response(JSON.stringify({ message: 'rate limit exceeded' }), { status: 503 })) as typeof fetch

	await assert.rejects(() => readTextFileFromRepo('token', 'owner', 'repo', 'public/blogs/index.json', 'main'), /read file failed: 503 rate limit exceeded/)
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

test('GitHub contents helpers encode path segments without escaping slashes', async () => {
	const urls: string[] = []
	globalThis.fetch = (async (input) => {
		urls.push(String(input))
		return new Response(JSON.stringify({ content: btoa('hello') }), { status: 200 })
	}) as typeof fetch

	assert.equal(await readTextFileFromRepo('token', 'owner', 'repo', 'public/blogs/hello world/index.json', 'main'), 'hello')

	assert.equal(urls[0], `${GH_API}/repos/owner/repo/contents/public/blogs/hello%20world/index.json?ref=main`)
})

test('putFile encodes nested contents paths segment by segment', async () => {
	const urls: string[] = []
	globalThis.fetch = (async (input, init) => {
		urls.push(String(input))
		if (init?.method === 'PUT') {
			return new Response(JSON.stringify({ content: { sha: 'next-sha' } }), { status: 200 })
		}
		return new Response(null, { status: 404 })
	}) as typeof fetch

	await putFile('token', 'owner', 'repo', 'public/blogs/hello world/index.md', btoa('hello'), 'message', 'main')

	assert.deepEqual(urls, [
		`${GH_API}/repos/owner/repo/contents/public/blogs/hello%20world/index.md?ref=main`,
		`${GH_API}/repos/owner/repo/contents/public/blogs/hello%20world/index.md`
	])
})

test('listRepoFilesRecursive encodes nested directory paths segment by segment', async () => {
	const urls: string[] = []
	globalThis.fetch = (async input => {
		urls.push(String(input))
		if (urls.length === 1) {
			return new Response(JSON.stringify([{ type: 'dir', path: 'public/blogs/hello world/assets' }]), { status: 200 })
		}
		return new Response(JSON.stringify([{ type: 'file', path: 'public/blogs/hello world/assets/a.png' }]), { status: 200 })
	}) as typeof fetch

	assert.deepEqual(await listRepoFilesRecursive('token', 'owner', 'repo', 'public/blogs/hello world', 'main'), [
		'public/blogs/hello world/assets/a.png'
	])
	assert.deepEqual(urls, [
		`${GH_API}/repos/owner/repo/contents/public/blogs/hello%20world?ref=main`,
		`${GH_API}/repos/owner/repo/contents/public/blogs/hello%20world/assets?ref=main`
	])
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
