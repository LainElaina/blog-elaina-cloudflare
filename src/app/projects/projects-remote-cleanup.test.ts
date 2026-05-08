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

const { buildUnusedProjectImageDeleteTreeItems, filterExistingProjectImageDeleteTreeItems } = await import('./services/push-projects')

test('remote projects save filters delete items to existing baseline image files', () => {
	const previousProjects = [
		{
			url: 'https://old.example.com',
			image: '/images/project/old.png'
		},
		{
			url: 'https://missing.example.com',
			image: '/images/project/missing.png?version=1'
		},
		{
			url: 'https://unsafe.example.com',
			image: '/images/project/../secret.png'
		}
	]
	const currentProjects = [
		{
			url: 'https://current.example.com',
			image: '/images/project/current.png'
		}
	]

	const deleteItems = buildUnusedProjectImageDeleteTreeItems(previousProjects, currentProjects)

	assert.deepEqual(filterExistingProjectImageDeleteTreeItems(deleteItems, ['public/images/project/old.png']), [
		{
			path: 'public/images/project/old.png',
			mode: '100644',
			type: 'blob',
			sha: null
		}
	])
})

test('remote projects save removes image files no longer referenced by list', async () => {
	const source = (await fs.readFile(new URL('./services/push-projects.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	assert.match(source, /readTextFileFromRepo/)
	assert.match(source, /const previousProjects = parsePreviousProjectList\(previousListJson\)/)
	assert.match(source, /listRepoFilesRecursive\([^\n]*'public\/images\/project', latestCommitSha\)/)
	assert.match(source, /function projectImageRepoDeletePath\(publicPath: string\): string \| null/)
	assert.match(source, /const pathOnly = publicPath\.split/)
	assert.match(source, /const filename = pathOnly\.slice\(PROJECT_IMAGE_PUBLIC_PREFIX\.length\)/)
	assert.match(source, /filename\.includes\('\/'\) \|\| filename\.includes\('\\\\'\) \|\| filename\.includes\('\.\.'\)/)
	assert.match(source, /function parsePreviousProjectList\(previousListJson: string \| null\): Project\[]/)
	assert.match(source, /filterExistingProjectImageDeleteTreeItems\(/)
	assert.match(source, /buildUnusedProjectImageDeleteTreeItems\(previousProjects, updatedProjects\)/)
	assert.match(source, /treeItems\.push\(\.\.\.deleteTreeItems\)/)
	assert.doesNotMatch(source, /for \(const path of previousImagePaths\)/)
	assert.doesNotMatch(source, /url\.replace\('\/images\/project\/', ''\)/)
	assert.match(source, /throw new Error\('远程项目列表解析失败，请修复 src\/app\/projects\/list\.json 后重试'\)/)
})

test('remote projects publish validates image content and retries the full attempt on ref conflicts', async () => {
	const source = (await fs.readFile(new URL('./services/push-projects.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')
	const attemptStart = source.indexOf('async function attemptPushProjects(): Promise<Project[]>')
	const extIndex = source.indexOf('const ext = getImageFileExtension(imageItem.file.name)', attemptStart)
	const validateIndex = source.indexOf('await assertAllowedImageFile(imageItem.file, ext)', attemptStart)
	const hashIndex = source.indexOf('const hash = imageItem.hash || (await hashFileSHA256(imageItem.file))', attemptStart)
	const retryIndex = source.indexOf('if (isGitHubUpdateRefConflictError(error))')

	assert.notEqual(attemptStart, -1)
	assert.ok(attemptStart < extIndex)
	assert.ok(extIndex < validateIndex)
	assert.ok(validateIndex < hashIndex)
	assert.notEqual(retryIndex, -1)
	assert.match(source, /try \{\n\s*return await attemptPushProjects\(\)\n\s*\} catch \(error\) \{[\s\S]*return attemptPushProjects\(\)/)
	assert.doesNotMatch(source, /getFileExt/)
})

test('remote projects cleanup errors are not reported as list parse errors', async () => {
	const source = (await fs.readFile(new URL('./services/push-projects.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')
	const parseStart = source.indexOf('function parsePreviousProjectList')
	const parseEnd = source.indexOf('export async function pushProjects')
	const cleanupIndex = source.indexOf('await listRepoFilesRecursive', parseEnd)

	assert.notEqual(parseStart, -1)
	assert.notEqual(parseEnd, -1)
	assert.notEqual(cleanupIndex, -1)
	assert.ok(parseStart < parseEnd)
	assert.ok(parseEnd < cleanupIndex)
	assert.doesNotMatch(source.slice(parseStart, parseEnd), /listRepoFilesRecursive/)
})
