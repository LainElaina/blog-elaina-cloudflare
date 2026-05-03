import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

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

test('createTree resolves a base commit sha to its tree sha before posting', async () => {
	const source = await readSource('./github-client.ts')

	assert.match(source, /export async function getCommit\(token: string, owner: string, repo: string, commitSha: string\): Promise<\{ sha: string; treeSha: string \}>/)
	assert.match(source, /\/git\/commits\/\$\{encodeURIComponent\(commitSha\)\}/)
	assert.match(source, /typeof data\?\.sha !== 'string' \|\| typeof data\?\.tree\?\.sha !== 'string'/)
	assert.match(source, /return \{ sha: data\.sha, treeSha: data\.tree\.sha \}/)
	assert.match(source, /export async function createTree\(token: string, owner: string, repo: string, tree: TreeItem\[\], baseTreeCommitSha\?: string\): Promise<\{ sha: string \}>/)
	assert.match(source, /const baseTree = baseTreeCommitSha \? \(await getCommit\(token, owner, repo, baseTreeCommitSha\)\)\.treeSha : undefined/)
	assert.match(source, /body: JSON\.stringify\(\{ tree, base_tree: baseTree \}\)/)
	assert.doesNotMatch(source, /body: JSON\.stringify\(\{ tree, base_tree: baseTreeCommitSha \}\)/)
})

test('remote save flows read existing artifacts from the captured base commit', async () => {
	const batchDeleteBlogs = await readSource('../app/blog/services/batch-delete-blogs.ts')
	assert.match(batchDeleteBlogs, /const latestCommitSha = refData\.sha[\s\S]*?listRepoFilesRecursive\([^\n]*latestCommitSha\)/)
	assert.match(batchDeleteBlogs, /const latestCommitSha = refData\.sha[\s\S]*?removeBlogsFromIndex\([^\n]*latestCommitSha\)/)
	assert.doesNotMatch(batchDeleteBlogs, /listRepoFilesRecursive\([^\n]*GITHUB_CONFIG\.BRANCH\)/)
	assert.doesNotMatch(batchDeleteBlogs, /removeBlogsFromIndex\([^\n]*GITHUB_CONFIG\.BRANCH\)/)

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
