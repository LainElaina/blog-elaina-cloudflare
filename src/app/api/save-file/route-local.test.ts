import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { registerHooks } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { isAllowedSaveFilePath } from './local-save-file-path.ts'

registerHooks({
	resolve(specifier, context, nextResolve) {
		if (specifier === 'next/server') {
			return nextResolve('next/server.js', context)
		}
		return nextResolve(specifier, context)
	}
})

const { handleSaveFile } = await import('./route-local.ts')

test('save-file local route allows only known content files and blog artifacts', () => {
	const projectDir = resolve('/repo/blog')

	assert.equal(isAllowedSaveFilePath(projectDir, resolve(projectDir, 'src/app/about/list.json')), true)
	assert.equal(isAllowedSaveFilePath(projectDir, resolve(projectDir, 'public/share/storage.json')), true)
	assert.equal(isAllowedSaveFilePath(projectDir, resolve(projectDir, 'public/blogs/post-a/index.md')), true)
	assert.equal(isAllowedSaveFilePath(projectDir, resolve(projectDir, 'public/blogs/post-a/config.json')), true)
})

test('save-file local route rejects blog artifact directory root as a file path', () => {
	const projectDir = resolve('/repo/blog')

	assert.equal(isAllowedSaveFilePath(projectDir, resolve(projectDir, 'public/blogs')), false)
})

test('save-file local route rejects project files outside the write allowlist', () => {
	const projectDir = resolve('/repo/blog')

	assert.equal(isAllowedSaveFilePath(projectDir, resolve(projectDir, 'package.json')), false)
	assert.equal(isAllowedSaveFilePath(projectDir, resolve(projectDir, '.env')), false)
	assert.equal(isAllowedSaveFilePath(projectDir, resolve(projectDir, 'src/app/api/save-file/route-local.ts')), false)
	assert.equal(isAllowedSaveFilePath(projectDir, resolve(projectDir, 'public/blogs/Bad-Slug/index.md')), false)
	assert.equal(isAllowedSaveFilePath(projectDir, resolve(projectDir, 'public/blogs/bad slug/index.md')), false)
	assert.equal(isAllowedSaveFilePath(projectDir, resolve(projectDir, 'public/blogs/post..name/index.md')), false)
	assert.equal(isAllowedSaveFilePath(projectDir, resolve(projectDir, 'public/blogs/post-a/cover.png')), false)
	assert.equal(isAllowedSaveFilePath(projectDir, resolve(projectDir, 'public/blogs/post-a/nested/index.md')), false)
	assert.equal(isAllowedSaveFilePath(projectDir, resolve(projectDir, 'public/blogs-backup/post-a/index.md')), false)
	assert.equal(isAllowedSaveFilePath(projectDir, resolve('/repo/blog-backup/public/blogs/post-a/index.md')), false)
})

test('save-file local route creates parent directories without an existence precheck', async () => {
	const source = await import('node:fs/promises').then(fs => fs.readFile(new URL('./route-local.ts', import.meta.url), 'utf-8'))

	assert.doesNotMatch(source, /existsSync/)
	assert.match(source, /await mkdir\(dir, \{ recursive: true \}\)/)
})

test('save-file local route replaces files atomically', async () => {
	const source = await import('node:fs/promises').then(fs => fs.readFile(new URL('./route-local.ts', import.meta.url), 'utf-8'))

	assert.match(source, /import \{ mkdir, realpath, rename, rm, writeFile \} from 'fs\/promises'/)
	assert.match(source, /function buildAtomicSaveTempPath\(fullPath: string\)/)
	assert.match(source, /await writeFile\(tempPath, content, 'utf-8'\)\n\t\tawait rename\(tempPath, fullPath\)/)
	assert.match(source, /await rm\(tempPath, \{ force: true \}\)\.catch\(\(\) => undefined\)/)
	assert.match(source, /await writeFileAtomically\(fullPath, content\)/)
	assert.doesNotMatch(source, /await writeFile\(fullPath, content, 'utf-8'\)/)
})

test('save-file local route rejects invalid JSON content without replacing existing files', async () => {
	const previousCwd = process.cwd()
	const repoDir = await mkdtemp(join(tmpdir(), 'save-file-json-'))
	try {
		await mkdir(join(repoDir, 'public/share'), { recursive: true })
		await writeFile(join(repoDir, 'public/share/storage.json'), '{"ok":true}', 'utf-8')
		process.chdir(repoDir)

		const response = await handleSaveFile({
			json: async () => ({ path: 'public/share/storage.json', content: '{bad' })
		} as any)

		assert.equal(response.status, 400)
		assert.deepEqual(await response.json(), { error: 'JSON 内容格式错误' })
		assert.equal(await readFile(join(repoDir, 'public/share/storage.json'), 'utf-8'), '{"ok":true}')
	} finally {
		process.chdir(previousCwd)
		await rm(repoDir, { recursive: true, force: true })
	}
})

test('save-file local route rejects invalid allowlisted JSON shapes without replacing existing files', async () => {
	for (const [filePath, previousContent, nextContent] of [
		['public/share/storage.json', '{"version":1,"updatedAt":"now","shares":{}}', '[]'],
		['src/app/snippets/list.json', '["old"]', '{"snippet":"bad"}'],
		['public/blogs/post-a/config.json', '{"title":"old","tags":[],"date":"2026-01-01"}', '[]']
	] as const) {
		const previousCwd = process.cwd()
		const repoDir = await mkdtemp(join(tmpdir(), 'save-file-json-shape-'))
		try {
			await mkdir(join(repoDir, dirname(filePath)), { recursive: true })
			await writeFile(join(repoDir, filePath), previousContent, 'utf-8')
			process.chdir(repoDir)

			const response = await handleSaveFile({
				json: async () => ({ path: filePath, content: nextContent })
			} as any)

			assert.equal(response.status, 400, filePath)
			assert.deepEqual(await response.json(), { error: 'JSON 内容结构错误' }, filePath)
			assert.equal(await readFile(join(repoDir, filePath), 'utf-8'), previousContent, filePath)
		} finally {
			process.chdir(previousCwd)
			await rm(repoDir, { recursive: true, force: true })
		}
	}
})

test('save-file local route rejects unsafe blog artifact slugs without replacing existing files', async () => {
	const tooLongSlug = 'x'.repeat(121)
	for (const [filePath, nextContent] of [
		[
			'public/blogs/index.json',
			JSON.stringify([
				{
					slug: 'Post-A',
					title: 'Post A',
					tags: [],
					date: '2026-01-01'
				}
			])
		],
		[
			'public/blogs/index.json',
			JSON.stringify([
				{
					slug: tooLongSlug,
					title: 'Too Long',
					tags: [],
					date: '2026-01-01'
				}
			])
		],
		[
			'public/blogs/storage.json',
			JSON.stringify({
				version: 1,
				updatedAt: 'now',
				blogs: {
					'Post-A': {
						slug: 'Post-A',
						title: 'Post A',
						tags: [],
						date: '2026-01-01',
						status: 'published'
					}
				}
			})
		],
		[
			'public/blogs/storage.json',
			JSON.stringify({
				version: 1,
				updatedAt: 'now',
				blogs: {
					[tooLongSlug]: {
						slug: tooLongSlug,
						title: 'Too Long',
						tags: [],
						date: '2026-01-01',
						status: 'published'
					}
				}
			})
		]
	] as const) {
		const previousCwd = process.cwd()
		const repoDir = await mkdtemp(join(tmpdir(), 'save-file-blog-slug-'))
		const previousContent = filePath.endsWith('index.json') ? '[]' : '{"version":1,"updatedAt":"now","blogs":{}}'

		try {
			await mkdir(join(repoDir, dirname(filePath)), { recursive: true })
			await writeFile(join(repoDir, filePath), previousContent, 'utf-8')
			process.chdir(repoDir)

			const response = await handleSaveFile({
				json: async () => ({ path: filePath, content: nextContent })
			} as any)

			assert.equal(response.status, 400, filePath)
			assert.deepEqual(await response.json(), { error: 'JSON 内容结构错误' }, filePath)
			assert.equal(await readFile(join(repoDir, filePath), 'utf-8'), previousContent, filePath)
		} finally {
			process.chdir(previousCwd)
			await rm(repoDir, { recursive: true, force: true })
		}
	}
})

test('save-file local route rejects unsafe share storage slugs without replacing existing files', async () => {
	for (const slug of ['../alpha', 'Alpha']) {
		const previousCwd = process.cwd()
		const repoDir = await mkdtemp(join(tmpdir(), 'save-file-share-slug-'))
		const filePath = 'public/share/storage.json'
		const previousContent = '{"version":1,"updatedAt":"now","shares":{}}'
		const nextContent = JSON.stringify({
			version: 1,
			updatedAt: 'now',
			shares: {
				[slug]: {
					slug,
					name: 'Alpha',
					logo: '/alpha.png',
					url: 'https://alpha.dev',
					description: 'alpha',
					tags: ['tool'],
					stars: 4,
					status: 'published'
				}
			}
		})

		try {
			await mkdir(join(repoDir, dirname(filePath)), { recursive: true })
			await writeFile(join(repoDir, filePath), previousContent, 'utf-8')
			process.chdir(repoDir)

			const response = await handleSaveFile({
				json: async () => ({ path: filePath, content: nextContent })
			} as any)

			assert.equal(response.status, 400, slug)
			assert.deepEqual(await response.json(), { error: 'JSON 内容结构错误' }, slug)
			assert.equal(await readFile(join(repoDir, filePath), 'utf-8'), previousContent, slug)
		} finally {
			process.chdir(previousCwd)
			await rm(repoDir, { recursive: true, force: true })
		}
	}
})

test('save-file local route rejects allowlisted paths under symlinked parent directories', async () => {
	const previousCwd = process.cwd()
	const repoDir = await mkdtemp(join(tmpdir(), 'save-file-symlink-'))
	const outsideDir = await mkdtemp(join(tmpdir(), 'save-file-outside-'))
	try {
		await mkdir(join(repoDir, 'public'), { recursive: true })
		await symlink(outsideDir, join(repoDir, 'public/blogs'))
		process.chdir(repoDir)

		const response = await handleSaveFile({
			json: async () => ({ path: 'public/blogs/post-a/index.md', content: 'escaped' })
		} as any)

		assert.equal(response.status, 500)
		assert.deepEqual(await response.json(), { error: '保存失败' })
		await assert.rejects(() => readFile(join(outsideDir, 'post-a/index.md'), 'utf-8'), /ENOENT/)
	} finally {
		process.chdir(previousCwd)
		await rm(repoDir, { recursive: true, force: true })
		await rm(outsideDir, { recursive: true, force: true })
	}
})

test('save-file local route rejects allowlisted paths under repo-internal symlinked parent directories', async () => {
	const previousCwd = process.cwd()
	const repoDir = await mkdtemp(join(tmpdir(), 'save-file-inner-symlink-'))
	try {
		await mkdir(join(repoDir, 'public'), { recursive: true })
		await mkdir(join(repoDir, 'public/redirected-blogs'), { recursive: true })
		await symlink(join(repoDir, 'public/redirected-blogs'), join(repoDir, 'public/blogs'))
		process.chdir(repoDir)

		const response = await handleSaveFile({
			json: async () => ({ path: 'public/blogs/post-a/index.md', content: 'redirected' })
		} as any)

		assert.equal(response.status, 500)
		assert.deepEqual(await response.json(), { error: '保存失败' })
		await assert.rejects(() => readFile(join(repoDir, 'public/redirected-blogs/post-a/index.md'), 'utf-8'), /ENOENT/)
	} finally {
		process.chdir(previousCwd)
		await rm(repoDir, { recursive: true, force: true })
	}
})

test('save-file local route keeps blog markdown writes outside JSON shape validation', async () => {
	const previousCwd = process.cwd()
	const repoDir = await mkdtemp(join(tmpdir(), 'save-file-md-'))
	try {
		process.chdir(repoDir)

		const response = await handleSaveFile({
			json: async () => ({ path: 'public/blogs/post-a/index.md', content: 'not json' })
		} as any)

		assert.equal(response.status, 200)
		assert.deepEqual(await response.json(), { success: true })
		assert.equal(await readFile(join(repoDir, 'public/blogs/post-a/index.md'), 'utf-8'), 'not json')
	} finally {
		process.chdir(previousCwd)
		await rm(repoDir, { recursive: true, force: true })
	}
})

test('save-file local route returns 413 for oversized request before JSON parsing', async () => {
	let jsonCalled = false
	const response = await handleSaveFile({
		headers: new Headers({ 'content-length': String(11 * 1024 * 1024 + 1) }),
		json: async () => {
			jsonCalled = true
			throw new Error('json should not be called')
		}
	} as any)

	assert.equal(response.status, 413)
	assert.equal(jsonCalled, false)
	assert.deepEqual(await response.json(), { error: '文件内容超过 10MB 限制' })
})

test('save-file local route returns 413 for oversized file content after JSON parsing', async () => {
	const response = await handleSaveFile({
		json: async () => ({ path: 'public/blogs/post-a/index.md', content: 'x'.repeat(10 * 1024 * 1024 + 1) })
	} as any)

	assert.equal(response.status, 413)
	assert.deepEqual(await response.json(), { error: '文件内容超过 10MB 限制' })
})

test('save-file local route limits streamed JSON requests without content-length', async () => {
	let pulled = 0
	const encoder = new TextEncoder()
	const response = await handleSaveFile(
		new Request('http://localhost/api/save-file', {
			method: 'POST',
			body: new ReadableStream({
				pull(controller) {
					pulled += 1
					controller.enqueue(encoder.encode('x'.repeat(1024 * 1024)))
				}
			}),
			duplex: 'half'
		} as RequestInit)
	)

	assert.equal(response.status, 413)
	assert.equal(pulled <= 12, true)
	assert.deepEqual(await response.json(), { error: '文件内容超过 10MB 限制' })
})

test('save-file local route returns 400 when JSON body is malformed', async () => {
	const response = await handleSaveFile({
		json: async () => {
			throw new SyntaxError('bad json')
		}
	} as any)

	assert.equal(response.status, 400)
	assert.deepEqual(await response.json(), { error: '请求体格式错误' })
})

test('save-file local route returns 400 when JSON body is not an object', async () => {
	for (const body of [null, []]) {
		const response = await handleSaveFile({
			json: async () => body
		} as any)

		assert.equal(response.status, 400)
		assert.deepEqual(await response.json(), { error: '请求体格式错误' })
	}
})
