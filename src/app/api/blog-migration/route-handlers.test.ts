import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'

import { previewRoute, executeRoute } from './route-handlers.ts'
import { withLocalContentMutationLock } from '../local-content-mutation-lock.ts'

type BlogRuntimeArtifactsToWrite = {
	index: string
	categories: string
	folders: string
	storage: string
}

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

async function writeBlogArtifacts(baseDir: string, artifacts: BlogRuntimeArtifactsToWrite) {
	const blogsDir = join(baseDir, 'public/blogs')
	await writeFile(join(blogsDir, 'index.json'), artifacts.index)
	await writeFile(join(blogsDir, 'categories.json'), artifacts.categories)
	await writeFile(join(blogsDir, 'folders.json'), artifacts.folders)
	await writeFile(join(blogsDir, 'storage.json'), artifacts.storage)
}

async function readPreviewSnapshotHash(baseDir: string) {
	const response = await previewRoute({
		nodeEnv: 'development',
		baseDir
	})

	assert.equal(response.status, 200)
	assert.equal(typeof response.body.snapshotHash, 'string')
	return response.body.snapshotHash
}

function deferred() {
	let resolve!: () => void
	const promise = new Promise<void>(next => {
		resolve = next
	})
	return { promise, resolve }
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

	it('execute route 缺少预检查快照时返回 409 且不会写回', async () => {
		const context = await setupBlogArtifactsRepo()
		let writeCalled = false

		try {
			const response = await executeRoute({
				nodeEnv: 'development',
				confirmed: true,
				baseDir: context.repoDir,
				writeRuntimeArtifactsForTest: async () => {
					writeCalled = true
					throw new Error('writeRuntimeArtifactsForTest should not be called')
				}
			})

			assert.equal(response.status, 409)
			assert.equal(response.body.code, 'STALE_PREVIEW')
			assert.equal(response.body.shouldRepreview, true)
			assert.equal(writeCalled, false)
		} finally {
			await context.cleanup()
		}
	})

	it('execute route 拒绝过期预检查快照且不会写回', async () => {
		const context = await setupBlogArtifactsRepo()
		let writeCalled = false

		try {
			const snapshotHash = await readPreviewSnapshotHash(context.repoDir)
			const categoriesPath = join(context.repoDir, 'public/blogs/categories.json')
			const changedCategories = JSON.stringify({ categories: ['外部更新'] }, null, 2)
			await writeFile(categoriesPath, changedCategories)

			const response = await executeRoute({
				nodeEnv: 'development',
				confirmed: true,
				snapshotHash,
				baseDir: context.repoDir,
				writeRuntimeArtifactsForTest: async () => {
					writeCalled = true
					throw new Error('writeRuntimeArtifactsForTest should not be called')
				}
			})

			assert.equal(response.status, 409)
			assert.equal(response.body.code, 'STALE_PREVIEW')
			assert.equal(response.body.shouldRepreview, true)
			assert.equal(writeCalled, false)
			assert.equal(await readFile(categoriesPath, 'utf8'), changedCategories)
		} finally {
			await context.cleanup()
		}
	})

	it('preview route 拒绝 symlinked 博客正式产物目录且不会读取外部目录', async () => {
		const repoDir = await mkdtemp(join(tmpdir(), 'blog-migration-preview-symlink-repo-'))
		const outsideDir = await mkdtemp(join(tmpdir(), 'blog-migration-preview-symlink-outside-'))

		try {
			await mkdir(join(repoDir, 'public'), { recursive: true })
			await symlink(outsideDir, join(repoDir, 'public/blogs'))
			await writeFile(
				join(outsideDir, 'index.json'),
				JSON.stringify(
					[
						{
							slug: 'post-a',
							title: 'A',
							tags: [],
							date: '2026-04-13T07:00:00.000Z',
							category: '技术'
						}
					],
					null,
					2
				)
			)
			await writeFile(join(outsideDir, 'categories.json'), JSON.stringify({ categories: [] }, null, 2))
			await writeFile(join(outsideDir, 'folders.json'), JSON.stringify([], null, 2))

			const response = await previewRoute({ nodeEnv: 'development', baseDir: repoDir })

			assert.equal(response.status, 403)
			assert.deepEqual(response.body, { message: '博客正式产物路径不合法' })
		} finally {
			await rm(repoDir, { recursive: true, force: true })
			await rm(outsideDir, { recursive: true, force: true })
		}
	})

	it('execute route 拒绝 symlinked 博客正式产物目录且不会写到重定向目录', async () => {
		const repoDir = await mkdtemp(join(tmpdir(), 'blog-migration-symlink-repo-'))
		const outsideDir = await mkdtemp(join(tmpdir(), 'blog-migration-symlink-outside-'))

		try {
			await mkdir(join(repoDir, 'public'), { recursive: true })
			await symlink(outsideDir, join(repoDir, 'public/blogs'))
			await writeFile(
				join(outsideDir, 'index.json'),
				JSON.stringify(
					[
						{
							slug: 'post-a',
							title: 'A',
							tags: [],
							date: '2026-04-13T07:00:00.000Z',
							category: '技术'
						}
					],
					null,
					2
				)
			)
			await writeFile(join(outsideDir, 'categories.json'), JSON.stringify({ categories: [] }, null, 2))
			await writeFile(join(outsideDir, 'folders.json'), JSON.stringify([], null, 2))

			const response = await executeRoute({
				nodeEnv: 'development',
				confirmed: true,
				snapshotHash: 'stale-snapshot',
				baseDir: repoDir
			})

			assert.equal(response.status, 403)
			assert.deepEqual(response.body, { message: '博客正式产物路径不合法' })
			await assert.rejects(() => readFile(join(outsideDir, 'storage.json'), 'utf8'), /ENOENT/)
			assert.deepEqual(JSON.parse(await readFile(join(outsideDir, 'categories.json'), 'utf8')), { categories: [] })
		} finally {
			await rm(repoDir, { recursive: true, force: true })
			await rm(outsideDir, { recursive: true, force: true })
		}
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

	it('preview route 拒绝大写博客 slug', async () => {
		const context = await setupBlogArtifactsRepo()

		try {
			await writeFile(
				join(context.repoDir, 'public/blogs/index.json'),
				JSON.stringify(
					[
						{
							slug: 'Post-A',
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

	it('preview route 拒绝非法 storage 可选字段结构', async () => {
		const context = await setupBlogArtifactsRepo()

		try {
			await writeFile(
				join(context.repoDir, 'public/blogs/storage.json'),
				JSON.stringify(
					{
						version: 1,
						updatedAt: '2026-04-13T07:00:00.000Z',
						blogs: {
							'post-a': {
								slug: 'post-a',
								title: 'A',
								tags: [],
								date: '2026-04-13T07:00:00.000Z',
								status: 'published',
								category: 1,
								folderPath: [],
								favorite: 'true'
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
			const snapshotHash = await readPreviewSnapshotHash(context.repoDir)
			const response = await executeRoute({
				nodeEnv: 'development',
				confirmed: true,
				snapshotHash,
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

	it('execute route 基于写回后的磁盘状态复检', async () => {
		const context = await setupBlogArtifactsRepo()

		try {
			const snapshotHash = await readPreviewSnapshotHash(context.repoDir)
			const response = await executeRoute({
				nodeEnv: 'development',
				confirmed: true,
				snapshotHash,
				baseDir: context.repoDir,
				writeRuntimeArtifactsForTest: async (baseDir, artifacts) => {
					await writeBlogArtifacts(baseDir, artifacts)
					await writeFile(join(baseDir, 'public/blogs/categories.json'), JSON.stringify({ categories: [] }, null, 2))
				}
			})

			assert.equal(response.status, 200)
			assert.deepEqual(response.body.artifactsToRebuildAfterExecute, ['public/blogs/categories.json'])
		} finally {
			await context.cleanup()
		}
	})

	it('preview route 会等待共享博客内容写入锁再读取快照', async () => {
		const context = await setupBlogArtifactsRepo()
		const releaseLock = deferred()
		const lockEntered = deferred()
		const categoriesPath = join(context.repoDir, 'public/blogs/categories.json')
		const validCategories = JSON.stringify({ categories: [] }, null, 2)

		try {
			const lock = withLocalContentMutationLock(context.repoDir, 'blog', async () => {
				await writeFile(categoriesPath, '{')
				lockEntered.resolve()
				await releaseLock.promise
				await writeFile(categoriesPath, validCategories)
			})
			await lockEntered.promise

			const responsePromise = previewRoute({
				nodeEnv: 'development',
				baseDir: context.repoDir
			})
			const responseBeforeRelease = await Promise.race([
				responsePromise,
				new Promise<null>(resolve => setTimeout(() => resolve(null), 50))
			])

			assert.equal(responseBeforeRelease, null)

			releaseLock.resolve()
			const response = await responsePromise
			await lock

			assert.equal(response.status, 200)
		} finally {
			releaseLock.resolve()
			await context.cleanup()
		}
	})

	it('execute route 会等待共享博客内容写入锁', async () => {
		const context = await setupBlogArtifactsRepo()
		const releaseLock = deferred()
		const lockEntered = deferred()
		let writeCalled = false

		try {
			const source = await readFile(new URL('./route-handlers.ts', import.meta.url), 'utf-8')
			assert.match(source, /return withLocalContentMutationLock\(baseDir, 'blog', async \(\) => \{\s*try \{\s*const runtimeSnapshot = await readRuntimeArtifactSnapshot\(baseDir\)/)

			const snapshotHash = await readPreviewSnapshotHash(context.repoDir)
			const lock = withLocalContentMutationLock(context.repoDir, 'blog', async () => {
				lockEntered.resolve()
				await releaseLock.promise
			})
			await lockEntered.promise

			const responsePromise = executeRoute({
				nodeEnv: 'development',
				confirmed: true,
				snapshotHash,
				baseDir: context.repoDir,
				writeRuntimeArtifactsForTest: async (baseDir, artifacts) => {
					writeCalled = true
					await writeBlogArtifacts(baseDir, artifacts)
				}
			})
			await Promise.resolve()

			assert.equal(writeCalled, false)

			releaseLock.resolve()
			const response = await responsePromise
			await lock

			assert.equal(response.status, 200)
			assert.equal(writeCalled, true)
		} finally {
			releaseLock.resolve()
			await context.cleanup()
		}
	})

	it('execute route 会串行化并发确认迁移', async () => {
		const context = await setupBlogArtifactsRepo()
		const events: string[] = []
		let releaseFirstWrite!: () => void
		const firstWriteStarted = new Promise<void>(resolve => {
			releaseFirstWrite = resolve
		})
		let firstWriteRelease!: () => void
		const firstWriteBlocked = new Promise<void>(resolve => {
			firstWriteRelease = resolve
		})
		let writeCount = 0

		try {
			const snapshotHash = await readPreviewSnapshotHash(context.repoDir)
			const writeRuntimeArtifactsForTest = async (baseDir: string, artifacts: BlogRuntimeArtifactsToWrite) => {
				writeCount += 1
				events.push(`write-${writeCount}`)
				if (writeCount === 1) {
					releaseFirstWrite()
					await firstWriteBlocked
				}
				await writeBlogArtifacts(baseDir, artifacts)
			}

			const firstExecute = executeRoute({
				nodeEnv: 'development',
				confirmed: true,
				snapshotHash,
				baseDir: context.repoDir,
				writeRuntimeArtifactsForTest
			})
			await firstWriteStarted

			const secondExecute = executeRoute({
				nodeEnv: 'development',
				confirmed: true,
				snapshotHash,
				baseDir: context.repoDir,
				writeRuntimeArtifactsForTest
			})
			await Promise.resolve()

			assert.deepEqual(events, ['write-1'])

			firstWriteRelease()
			const [firstResponse, secondResponse] = await Promise.all([firstExecute, secondExecute])

			assert.equal(firstResponse.status, 200)
			assert.equal(secondResponse.status, 409)
			assert.equal(secondResponse.body.code, 'STALE_PREVIEW')
			assert.deepEqual(events, ['write-1'])
		} finally {
			firstWriteRelease?.()
			await context.cleanup()
		}
	})

	it('execute route 写回失败时返回结构化错误并要求重新预检', async () => {
		const context = await setupBlogArtifactsRepo()

		try {
			const snapshotHash = await readPreviewSnapshotHash(context.repoDir)
			const response = await executeRoute({
				nodeEnv: 'development',
				confirmed: true,
				snapshotHash,
				baseDir: context.repoDir,
				writeRuntimeArtifactsForTest: async () => {
					throw new Error('simulated write failure')
				}
			})

			assert.equal(response.status, 500)
			assert.deepEqual(response.body, {
				ok: false,
				code: 'WRITE_FAILED',
				message: '写入博客正式产物失败',
				shouldRepreview: true
			})
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

	it('execute route 的临时文件清理失败不会覆盖成功写回结果', async () => {
		const source = await readFile(new URL('./route-handlers.ts', import.meta.url), 'utf-8')

		assert.match(source, /await Promise\.all\(preparedWrites\.flatMap\(write => \[rm\(write\.tempPath, \{ force: true \}\)\.catch\(\(\) => undefined\), rm\(write\.backupPath, \{ force: true \}\)\.catch\(\(\) => undefined\)\]\)\)/)
	})
})
