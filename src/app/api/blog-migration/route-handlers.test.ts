import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'

import { previewRoute, executeRoute } from './route-handlers.ts'

async function setupBlogArtifactsRepo() {
	const repoDir = await mkdtemp(join(tmpdir(), 'blog-migration-route-'))
	const blogsDir = join(repoDir, 'public/blogs')

	await mkdir(blogsDir, { recursive: true })
	await writeFile(
		join(blogsDir, 'index.json'),
		JSON.stringify(
			[
				{
					slug: 'post-a',
					title: 'A',
					tags: [],
					date: '2026-04-13T07:00:00.000Z',
					category: '技术',
					favorite: false
				}
			],
			null,
			2
		)
	)
	await writeFile(join(blogsDir, 'categories.json'), JSON.stringify({ categories: [] }, null, 2))
	await writeFile(join(blogsDir, 'folders.json'), JSON.stringify([], null, 2))

	return {
		repoDir,
		cleanup: async () => rm(repoDir, { recursive: true, force: true })
	}
}

describe('blog migration routes', () => {
	it('preview route 在非 development 环境返回 403', async () => {
		const response = await previewRoute({ nodeEnv: 'production', baseDir: '/tmp/unused-blog-migration' })
		assert.equal(response.status, 403)
	})

	it('preview route 在 development 环境返回实际 verify 结果', async () => {
		const context = await setupBlogArtifactsRepo()

		try {
			const response = await previewRoute({
				nodeEnv: 'development',
				baseDir: context.repoDir
			})

			assert.equal(response.status, 200)
			assert.deepEqual(response.body.artifactsToRebuild, ['public/blogs/categories.json', 'public/blogs/storage.json'])
		} finally {
			await context.cleanup()
		}
	})

	it('execute route 在未确认时返回 400', async () => {
		const response = await executeRoute({ nodeEnv: 'development', confirmed: false, baseDir: '/tmp/unused-blog-migration' })
		assert.equal(response.status, 400)
		assert.equal(response.body.message, '执行前需要明确确认')
	})

	it('preview route 拒绝非法博客正式产物结构', async () => {
		const context = await setupBlogArtifactsRepo()

		try {
			await writeFile(join(context.repoDir, 'public/blogs/index.json'), JSON.stringify({ blogs: [] }, null, 2))
			const response = await previewRoute({
				nodeEnv: 'development',
				baseDir: context.repoDir
			})

			assert.equal(response.status, 400)
			assert.equal(response.body.code, 'ARTIFACT_INVALID_SHAPE')
			assert.deepEqual(response.body.details, { artifact: 'public/blogs/index.json' })
		} finally {
			await context.cleanup()
		}
	})

	it('execute route 拒绝非法博客正式产物结构且不会写回', async () => {
		const context = await setupBlogArtifactsRepo()

		try {
			const invalidIndex = JSON.stringify({ blogs: [] }, null, 2)
			await writeFile(join(context.repoDir, 'public/blogs/index.json'), invalidIndex)
			const response = await executeRoute({
				nodeEnv: 'development',
				confirmed: true,
				baseDir: context.repoDir
			})

			assert.equal(response.status, 400)
			assert.equal(response.body.code, 'ARTIFACT_INVALID_SHAPE')
			assert.equal(await readFile(join(context.repoDir, 'public/blogs/index.json'), 'utf8'), invalidIndex)
		} finally {
			await context.cleanup()
		}
	})

	it('preview route 拒绝非法博客 slug', async () => {
		const context = await setupBlogArtifactsRepo()

		try {
			await writeFile(
				join(context.repoDir, 'public/blogs/index.json'),
				JSON.stringify(
					[
						{
							slug: '../bad',
							title: 'Bad',
							tags: [],
							date: '2026-04-13T07:00:00.000Z'
						}
					],
					null,
					2
				)
			)
			const response = await previewRoute({
				nodeEnv: 'development',
				baseDir: context.repoDir
			})

			assert.equal(response.status, 400)
			assert.equal(response.body.code, 'ARTIFACT_INVALID_SHAPE')
			assert.deepEqual(response.body.details, { artifact: 'public/blogs/index.json' })
		} finally {
			await context.cleanup()
		}
	})

	it('execute route 拒绝重复博客 slug 且不会写回', async () => {
		const context = await setupBlogArtifactsRepo()

		try {
			const duplicateIndex = JSON.stringify(
				[
					{
						slug: 'post-a',
						title: 'A',
						tags: [],
						date: '2026-04-13T07:00:00.000Z'
					},
					{
						slug: 'post-a',
						title: 'A duplicate',
						tags: [],
						date: '2026-04-14T07:00:00.000Z'
					}
				],
				null,
				2
			)
			await writeFile(join(context.repoDir, 'public/blogs/index.json'), duplicateIndex)
			const response = await executeRoute({
				nodeEnv: 'development',
				confirmed: true,
				baseDir: context.repoDir
			})

			assert.equal(response.status, 400)
			assert.equal(response.body.code, 'ARTIFACT_INVALID_SHAPE')
			assert.equal(await readFile(join(context.repoDir, 'public/blogs/index.json'), 'utf8'), duplicateIndex)
		} finally {
			await context.cleanup()
		}
	})

	it('preview route 拒绝非法 storage slug key', async () => {
		const context = await setupBlogArtifactsRepo()

		try {
			await writeFile(
				join(context.repoDir, 'public/blogs/storage.json'),
				JSON.stringify(
					{
						version: 1,
						updatedAt: '2026-04-13T07:00:00.000Z',
						blogs: {
							'bad/slug': {
								slug: 'bad/slug',
								title: 'Bad',
								tags: [],
								date: '2026-04-13T07:00:00.000Z',
								status: 'draft'
							}
						}
					},
					null,
					2
				)
			)
			const response = await previewRoute({
				nodeEnv: 'development',
				baseDir: context.repoDir
			})

			assert.equal(response.status, 400)
			assert.equal(response.body.code, 'ARTIFACT_INVALID_SHAPE')
			assert.deepEqual(response.body.details, { artifact: 'public/blogs/storage.json' })
		} finally {
			await context.cleanup()
		}
	})

	it('execute route 在确认后会同步账本并重建正式产物', async () => {
		const context = await setupBlogArtifactsRepo()

		try {
			const response = await executeRoute({
				nodeEnv: 'development',
				confirmed: true,
				baseDir: context.repoDir
			})

			assert.equal(response.status, 200)
			assert.equal(response.body.ok, true)
			assert.deepEqual(response.body.writtenArtifacts, [
				'public/blogs/index.json',
				'public/blogs/categories.json',
				'public/blogs/folders.json',
				'public/blogs/storage.json'
			])
			assert.deepEqual(response.body.artifactsToRebuildAfterExecute, [])

			const categoriesRaw = await readFile(join(context.repoDir, 'public/blogs/categories.json'), 'utf8')
			const storageRaw = await readFile(join(context.repoDir, 'public/blogs/storage.json'), 'utf8')

			assert.deepEqual(JSON.parse(categoriesRaw), { categories: ['技术'] })
			assert.equal(JSON.parse(storageRaw).blogs['post-a'].slug, 'post-a')
		} finally {
			await context.cleanup()
		}
	})

	it('execute route 先写临时文件并用备份回滚保护正式产物一致性', async () => {
		const source = await readFile(new URL('./route-handlers.ts', import.meta.url), 'utf-8')

		assert.match(source, /tempPath: `\$\{write\.path\}\.\$\{timestamp\}\.tmp`/)
		assert.match(source, /backupPath: `\$\{write\.path\}\.\$\{timestamp\}\.bak`/)
		assert.match(source, /await writeFile\(write\.tempPath, write\.content\)/)
		assert.match(source, /await rename\(write\.tempPath, write\.path\)/)
		assert.match(source, /await rename\(write\.backupPath, write\.path\)/)
		assert.doesNotMatch(source, /Promise\.all\(\[\s*writeFile\(join\(blogsDir, 'index\.json'\)/)
	})
})
