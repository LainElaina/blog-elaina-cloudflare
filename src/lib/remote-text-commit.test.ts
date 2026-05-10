import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import { registerHooks } from 'node:module'
import { describe, test } from 'node:test'
import { fileURLToPath } from 'node:url'

const srcRootUrl = new URL('../', import.meta.url)
const constsModuleUrl = `data:text/javascript,${encodeURIComponent(`export const GITHUB_CONFIG = { OWNER: 'owner', REPO: 'repo', BRANCH: 'main' }`)}`
const authModuleUrl = `data:text/javascript,${encodeURIComponent(`export async function getAuthToken() { throw new Error('unexpected auth call') }`)}`
const githubClientModuleUrl = `data:text/javascript,${encodeURIComponent(`
export async function createBlob() { throw new Error('unexpected github call') }
export async function createCommit() { throw new Error('unexpected github call') }
export async function createTree() { throw new Error('unexpected github call') }
export async function getRef() { throw new Error('unexpected github call') }
export function isGitHubUpdateRefConflictError() { return false }
export function throwStaleRemoteWriteConflictError(error) { throw error }
export function toBase64Utf8(input) { return Buffer.from(input, 'utf8').toString('base64') }
export async function updateRef() { throw new Error('unexpected github call') }
`)}`

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
		if (specifier === '@/consts') {
			return { shortCircuit: true, url: constsModuleUrl }
		}
		if (specifier === '@/lib/auth') {
			return { shortCircuit: true, url: authModuleUrl }
		}
		if (specifier === '@/lib/github-client') {
			return { shortCircuit: true, url: githubClientModuleUrl }
		}
		if (specifier.startsWith('@/')) {
			const url = resolveProjectModule(srcRootUrl, specifier.slice(2))
			if (url) return { shortCircuit: true, url }
		}
		if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL) {
			const url = resolveProjectModule(new URL(context.parentURL), specifier)
			if (url) return { shortCircuit: true, url }
		}
		return nextResolve(specifier, context)
	}
})

const sourceFiles = {
	about: '../app/about/services/push-about.ts',
	snippets: '../app/snippets/services/push-snippets.ts',
	layoutSave: '../app/(home)/layout-save-panel.tsx',
	homeLayout: '../app/(home)/config-dialog/home-layout.tsx',
	colorConfig: '../app/(home)/config-dialog/color-config.tsx',
	componentStore: '../components/component-store.tsx'
} as const

const { assertAllowedRemoteBinaryFilePath, assertAllowedRemoteTextFilePath, commitRemoteFiles } = await import('./remote-text-commit.ts')

async function readSource(relativePath: string) {
	return (await fs.readFile(new URL(relativePath, import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')
}

describe('remote commit path allowlist', () => {
	test('allows only known remote text files', () => {
		for (const path of [
			'src/app/about/list.json',
			'src/config/custom-components.json',
			'src/config/card-styles.json',
			'src/config/color-presets.json',
			'public/blogs/storage.json',
			'public/share/list.json'
		]) {
			assert.equal(assertAllowedRemoteTextFilePath(path), path)
		}
	})

	test('rejects remote text writes outside the allowlist', () => {
		for (const path of [
			'',
			'/src/config/custom-components.json',
			'src/config/../consts.ts',
			'src\\config\\custom-components.json',
			'src/lib/auth.ts',
			'.github/workflows/deploy.yml',
			'public/images/custom-components/a.png',
			'public/blogs/post-a/index.md'
		]) {
			assert.throws(() => assertAllowedRemoteTextFilePath(path), /不允许远端写入路径/)
		}
	})

	test('allows only direct image files in known remote image locations', () => {
		for (const path of [
			'public/favicon.png',
			'public/images/avatar.png',
			'public/images/custom-components/a.png',
			'public/images/share/a.webp',
			'public/images/social-buttons/a.ico',
			'public/blogs/post-a/a.avif'
		]) {
			assert.equal(assertAllowedRemoteBinaryFilePath(path), path)
		}
	})

	test('rejects remote image writes outside direct image allowlist locations', () => {
		for (const path of [
			'',
			'/public/images/share/a.png',
			'public/images/share/../avatar.png',
			'public/images/share/a/b.png',
			'public/images/share/a.txt',
			'public/images/share/a.svg',
			'public/images/share/a.png/extra',
			'public\\images\\share\\a.png',
			'public/blogs/Blog-CF1/a.png',
			'public/blogs/post-a/nested/a.png',
			'.github/workflows/deploy.png'
		]) {
			assert.throws(() => assertAllowedRemoteBinaryFilePath(path), /不允许远端图片路径/)
		}
	})

	test('rejects remote binary commits with invalid image content before GitHub writes', async () => {
		const file = new File([new Uint8Array([0x4e, 0x4f, 0x54, 0x50, 0x4e, 0x47])], 'avatar.png', { type: 'image/png' })

		await assert.rejects(
			() =>
				commitRemoteFiles(
					{
						binaryFiles: [{ path: 'public/images/custom-components/avatar.png', file }]
					},
					'保存图片'
				),
			/图片内容与文件类型不匹配/
		)
	})
})

test('remote text commit helper blocks stale full-file writes on ref conflicts', async () => {
	const source = await readSource('./remote-text-commit.ts')

	assert.match(source, /export async function commitRemoteTextFiles\(files: RemoteTextFile\[], message: string\): Promise<void>/)
	assert.match(source, /async function attemptCommit\(\): Promise<void>/)
	assert.match(source, /const ref = await getRef/)
	assert.match(source, /const tree = await createTree\([\s\S]*treeItems, ref\.sha\)/)
	assert.match(source, /const commit = await createCommit\([\s\S]*message, tree\.sha, \[ref\.sha\]\)/)
	assert.match(source, /await updateRef\([\s\S]*commit\.sha\)/)
	assert.match(source, /catch \(error\) \{\n\s*throwStaleRemoteWriteConflictError\(error\)/)
	assert.doesNotMatch(source, /catch \(error\) \{[\s\S]*await attemptCommit\(\)/)
})

test('simple remote text writers use the shared stale-write-safe commit helper', async () => {
	for (const relativePath of [sourceFiles.about, sourceFiles.snippets]) {
		const source = await readSource(relativePath)

		assert.match(source, /import \{ commitRemoteTextFiles \} from '@\/lib\/remote-text-commit'/)
		assert.match(source, /await commitRemoteTextFiles\(/)
		assert.doesNotMatch(source, /updateRef/)
		assert.doesNotMatch(source, /getRef/)
	}
})

test('home config remote writers use the shared stale-write-safe commit helper', async () => {
	for (const relativePath of [sourceFiles.layoutSave, sourceFiles.homeLayout, sourceFiles.colorConfig]) {
		const source = await readSource(relativePath)

		assert.match(source, /await commitRemoteTextFiles\(/)
		assert.doesNotMatch(source, /getRef, create/)
		assert.doesNotMatch(source, /updateRef/)
	}
})

test('component store remote writes validate image content and atomically commit images with config', async () => {
	const source = await readSource(sourceFiles.componentStore)
	const validateIndex = source.indexOf('await assertAllowedImageFile(pendingImageFile.file, ext)')
	const pendingImageIndex = source.indexOf('pendingRemoteImageFilesRef.current.set(`public${imageUrl}`, pendingImageFile.file)')
	const saveComponentsIndex = source.indexOf('await commitRemoteFiles(')

	assert.match(source, /import \{ assertAllowedImageFile, getImageFileExtension \} from '@\/lib\/image-content-validation'/)
	assert.notEqual(validateIndex, -1)
	assert.notEqual(pendingImageIndex, -1)
	assert.ok(validateIndex < pendingImageIndex)
	assert.notEqual(saveComponentsIndex, -1)
	assert.match(source, /textFiles: \[[\s\S]*path: 'src\/config\/custom-components\.json'[\s\S]*binaryFiles/)
	assert.doesNotMatch(source, /commitRemoteBinaryFile/)
	assert.doesNotMatch(source, /commitRemoteTextFiles/)
	assert.doesNotMatch(source, /fileToBase64NoPrefix/)
	assert.doesNotMatch(source, /updateRef/)
})
