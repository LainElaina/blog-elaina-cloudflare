import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { fileURLToPath } from 'node:url'

const srcRootUrl = new URL('../../', import.meta.url)
const testDirUrl = new URL('./', import.meta.url)

function resolveProjectModule(baseUrl: URL, specifier: string) {
	const directUrl = new URL(specifier, baseUrl)
	if (existsSync(fileURLToPath(directUrl))) {
		return directUrl.href
	}

	for (const extension of ['.ts', '.tsx', '.js', '.jsx', '.json']) {
		const url = new URL(`${specifier}${extension}`, baseUrl)
		if (existsSync(fileURLToPath(url))) {
			return url.href
		}
	}

	return null
}

registerHooks({
	resolve(specifier, context, nextResolve) {
		if (specifier === 'sonner') {
			return {
				shortCircuit: true,
				url: 'data:text/javascript,export const toast = { info: () => undefined, success: () => undefined, error: () => undefined }'
			}
		}

		if (specifier === '@/config/site-content.json') {
			return {
				shortCircuit: true,
				url: 'data:application/json,{}'
			}
		}

		if (specifier.startsWith('@/')) {
			const resolved = resolveProjectModule(srcRootUrl, specifier.slice(2))
			if (resolved) {
				return { shortCircuit: true, url: resolved }
			}
		}

		if (specifier.startsWith('./') || specifier.startsWith('../')) {
			const resolved = resolveProjectModule(new URL(context.parentURL ?? testDirUrl.href), specifier)
			if (resolved) {
				return { shortCircuit: true, url: resolved }
			}
		}

		return nextResolve(specifier, context)
	}
})

const { buildUnusedBloggerAvatarDeleteTreeItems, filterExistingBloggerAvatarDeleteTreeItems } = await import('./services/push-bloggers')

test('remote bloggers save filters delete items to existing baseline avatar files', () => {
	const previousBloggers = [
		{
			url: 'https://old.example.com',
			avatar: '/images/blogger/old.png'
		},
		{
			url: 'https://missing.example.com',
			avatar: '/images/blogger/missing.png?version=1'
		},
		{
			url: 'https://unsafe.example.com',
			avatar: '/images/blogger/../secret.png'
		}
	]
	const currentBloggers = [
		{
			url: 'https://current.example.com',
			avatar: '/images/blogger/current.png'
		}
	]

	const deleteItems = buildUnusedBloggerAvatarDeleteTreeItems(previousBloggers, currentBloggers)

	assert.deepEqual(filterExistingBloggerAvatarDeleteTreeItems(deleteItems, ['public/images/blogger/old.png']), [
		{
			path: 'public/images/blogger/old.png',
			mode: '100644',
			type: 'blob',
			sha: null
		}
	])
})

test('remote bloggers save removes avatar files no longer referenced by list', async () => {
	const source = (await fs.readFile(new URL('./services/push-bloggers.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	assert.match(source, /readTextFileFromRepo/)
	assert.match(source, /const previousBloggers = parsePreviousBloggerList\(previousListJson\)/)
	assert.match(source, /listRepoFilesRecursive\([^\n]*'public\/images\/blogger', latestCommitSha\)/)
	assert.match(source, /function bloggerAvatarRepoDeletePath\(publicPath: string\): string \| null/)
	assert.match(source, /const pathOnly = publicPath\.split/)
	assert.match(source, /const filename = pathOnly\.slice\(BLOGGER_AVATAR_PUBLIC_PREFIX\.length\)/)
	assert.match(source, /filename\.includes\('\/'\) \|\| filename\.includes\('\\\\'\) \|\| filename\.includes\('\.\.'\)/)
	assert.match(source, /function parsePreviousBloggerList\(previousListJson: string \| null\): Blogger\[]/)
	assert.match(source, /filterExistingBloggerAvatarDeleteTreeItems\(/)
	assert.match(source, /buildUnusedBloggerAvatarDeleteTreeItems\(previousBloggers, updatedBloggers\)/)
	assert.match(source, /treeItems\.push\(\.\.\.deleteTreeItems\)/)
	assert.doesNotMatch(source, /for \(const path of previousAvatarPaths\)/)
	assert.doesNotMatch(source, /url\.replace\('\/images\/blogger\/', ''\)/)
	assert.match(source, /throw new Error\('远程友链列表解析失败，请修复 src\/app\/bloggers\/list\.json 后重试'\)/)
	assert.doesNotMatch(source, /正在检查需要删除的文件/)
})

test('remote bloggers publish validates avatar content and blocks stale full-list writes on ref conflicts', async () => {
	const source = (await fs.readFile(new URL('./services/push-bloggers.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')
	const attemptStart = source.indexOf('async function attemptPushBloggers(): Promise<Blogger[]>')
	const extIndex = source.indexOf('const ext = getImageFileExtension(avatarItem.file.name)', attemptStart)
	const validateIndex = source.indexOf('await assertAllowedImageFile(avatarItem.file, ext)', attemptStart)
	const hashIndex = source.indexOf('const hash = avatarItem.hash || (await hashFileSHA256(avatarItem.file))', attemptStart)
	const staleWriteIndex = source.indexOf('throwStaleRemoteWriteConflictError(error)')

	assert.notEqual(attemptStart, -1)
	assert.ok(attemptStart < extIndex)
	assert.ok(extIndex < validateIndex)
	assert.ok(validateIndex < hashIndex)
	assert.notEqual(staleWriteIndex, -1)
	assert.match(source, /try \{\n\s*return await attemptPushBloggers\(\)\n\s*\} catch \(error\) \{\n\s*throwStaleRemoteWriteConflictError\(error\)/)
	assert.doesNotMatch(source, /catch \(error\) \{[\s\S]*return attemptPushBloggers\(\)/)
	assert.doesNotMatch(source, /getFileExt/)
})

test('remote bloggers cleanup errors are not reported as list parse errors', async () => {
	const source = (await fs.readFile(new URL('./services/push-bloggers.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')
	const parseStart = source.indexOf('function parsePreviousBloggerList')
	const parseEnd = source.indexOf('export async function pushBloggers')
	const cleanupIndex = source.indexOf('await listRepoFilesRecursive', parseEnd)

	assert.notEqual(parseStart, -1)
	assert.notEqual(parseEnd, -1)
	assert.notEqual(cleanupIndex, -1)
	assert.ok(parseStart < parseEnd)
	assert.ok(parseEnd < cleanupIndex)
	assert.doesNotMatch(source.slice(parseStart, parseEnd), /listRepoFilesRecursive/)
})
