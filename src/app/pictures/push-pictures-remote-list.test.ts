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

const { buildUnusedPictureImageDeleteTreeItems, filterExistingPictureImageDeleteTreeItems } = await import('./services/push-pictures')

test('remote pictures publish filters delete items to existing baseline image files', () => {
	const previousPictures = [
		{
			id: 'old',
			title: 'Old',
			image: '/images/pictures/old.png',
			images: ['/images/pictures/missing.png?version=1']
		},
		{
			id: 'unsafe',
			title: 'Unsafe',
			image: '/images/pictures/../secret.png'
		}
	]
	const currentPictures = [
		{
			id: 'current',
			title: 'Current',
			image: '/images/pictures/current.png'
		}
	]

	const deleteItems = buildUnusedPictureImageDeleteTreeItems(previousPictures, currentPictures)

	assert.deepEqual(filterExistingPictureImageDeleteTreeItems(deleteItems, ['public/images/pictures/old.png']), [
		{
			path: 'public/images/pictures/old.png',
			mode: '100644',
			type: 'blob',
			sha: null
		}
	])
})

test('remote pictures publish blocks when previous list cannot be parsed', async () => {
	const source = await fs.readFile(new URL('./services/push-pictures.ts', import.meta.url), 'utf-8')

	assert.match(source, /function parsePreviousPictureList\(previousListJson: string \| null\): Picture\[]/)
	assert.match(source, /catch \(error\) \{\n\s*console\.error\('Failed to parse previous pictures list\.json:', error\)\n\s*throw new Error\('远程图床列表解析失败，请修复 src\/app\/pictures\/list\.json 后重试'\)/)
	assert.doesNotMatch(source, /catch \(error\) \{\n\s*console\.error\('Failed to parse previous list\.json:', error\)\n\s*\}\n\s*\}/)
})

test('remote pictures save only deletes safe local image paths', async () => {
	const source = (await fs.readFile(new URL('./services/push-pictures.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	assert.match(source, /function pictureImageRepoDeletePath\(publicPath: string\): string \| null/)
	assert.match(source, /const pathOnly = publicPath\.split/)
	assert.match(source, /const filename = pathOnly\.slice\(PICTURE_IMAGE_PUBLIC_PREFIX\.length\)/)
	assert.match(source, /filename\.includes\('\/'\) \|\| filename\.includes\('\\\\'\) \|\| filename\.includes\('\.\.'\)/)
	assert.match(source, /const previousPictures = parsePreviousPictureList\(previousListJson\)/)
	assert.match(source, /const existingPictureImagePaths = await listRepoFilesRecursive\([^\n]*'public\/images\/pictures', latestCommitSha\)/)
	assert.match(
		source,
		/const deleteTreeItems = filterExistingPictureImageDeleteTreeItems\(\n\s*buildUnusedPictureImageDeleteTreeItems\(previousPictures, updatedPictures\),\n\s*existingPictureImagePaths\n\s*\)/
	)
	assert.match(source, /treeItems\.push\(\.\.\.deleteTreeItems\)/)
	assert.doesNotMatch(source, /for \(const path of previousImagePaths\)/)
	assert.doesNotMatch(source, /url\.replace\('\/images\/pictures\/', ''\)/)
})

test('remote pictures save dedupes image uploads by filename to avoid hash extension collisions', async () => {
	const source = (await fs.readFile(new URL('./services/push-pictures.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	assert.match(source, /const uploadedPicturePaths = new Map<string, string>\(\)/)
	assert.match(source, /const publicPath = `\/images\/pictures\/\$\{filename\}`/)
	assert.match(source, /const filename = `\$\{hash\}\$\{ext\}`\n\s*const publicPath = `\/images\/pictures\/\$\{filename\}`\n\s*const uploadKey = filename/)
	assert.match(source, /if \(!uploadedPicturePaths\.has\(uploadKey\)\) \{[\s\S]*?uploadedPicturePaths\.set\(uploadKey, publicPath\)[\s\S]*?\}/)
	assert.match(source, /pathReplacements\.set\(key, uploadedPicturePaths\.get\(uploadKey\)!\)/)
	assert.match(source, /updatedPictures = applyPictureImagePathReplacements\(updatedPictures, pathReplacements\)/)
	assert.doesNotMatch(source, /uploadedPicturePaths\.has\(hash\)/)
	assert.doesNotMatch(source, /uploadedPicturePaths\.set\(hash, publicPath\)/)
	assert.doesNotMatch(source, /uploadedHashes/)
})

test('remote pictures publish validates image content and blocks stale full-list writes on ref conflicts', async () => {
	const source = (await fs.readFile(new URL('./services/push-pictures.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')
	const attemptStart = source.indexOf('async function attemptPushPictures(): Promise<Picture[]>')
	const extIndex = source.indexOf('const ext = getImageFileExtension(imageItem.file.name)', attemptStart)
	const validateIndex = source.indexOf('await assertAllowedImageFile(imageItem.file, ext)', attemptStart)
	const hashIndex = source.indexOf('const hash = imageItem.hash || (await hashFileSHA256(imageItem.file))', attemptStart)
	const staleWriteIndex = source.indexOf('throwStaleRemoteWriteConflictError(error)')

	assert.notEqual(attemptStart, -1)
	assert.ok(attemptStart < extIndex)
	assert.ok(extIndex < validateIndex)
	assert.ok(validateIndex < hashIndex)
	assert.notEqual(staleWriteIndex, -1)
	assert.match(source, /try \{\n\s*return await attemptPushPictures\(\)\n\s*\} catch \(error\) \{\n\s*throwStaleRemoteWriteConflictError\(error\)/)
	assert.doesNotMatch(source, /catch \(error\) \{[\s\S]*return attemptPushPictures\(\)/)
	assert.doesNotMatch(source, /getFileExt/)
})

test('remote pictures cleanup errors are not reported as list parse errors', async () => {
	const source = (await fs.readFile(new URL('./services/push-pictures.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')
	const parseStart = source.indexOf('function parsePreviousPictureList')
	const parseEnd = source.indexOf('export async function pushPictures')
	const cleanupIndex = source.indexOf('await listRepoFilesRecursive', parseEnd)

	assert.notEqual(parseStart, -1)
	assert.notEqual(parseEnd, -1)
	assert.notEqual(cleanupIndex, -1)
	assert.ok(parseStart < parseEnd)
	assert.ok(parseEnd < cleanupIndex)
	assert.doesNotMatch(source.slice(parseStart, parseEnd), /listRepoFilesRecursive/)
})

test('remote pictures save rejects malformed image item keys before replacement', async () => {
	const source = (await fs.readFile(new URL('./services/push-pictures.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	assert.match(source, /imageItem\.type === 'file' && isPictureImageReplacementKey\(key\)/)
	assert.doesNotMatch(source, /const imageIndex = Number\(indexStr\) \|\| 0/)
	assert.doesNotMatch(source, /const \[groupId, indexStr\] = key\.split\('::'\)/)
})
