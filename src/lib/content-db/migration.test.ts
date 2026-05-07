import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { access, constants, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { promisify } from 'node:util'

import { createContentDb } from './client.ts'
import { applyContentDbMigrations } from './migrations.ts'
import { migrateLegacyContentToDb } from './migration.ts'

type TempContext = {
	repoDir: string
	dbPath: string
	cleanup: () => Promise<void>
}

const execFileAsync = promisify(execFile)

async function runVerifyScript(repoDir: string, dbPath: string): Promise<{ stdout: string; stderr: string }> {
	return execFileAsync(process.execPath, ['/app/blog-elaina-cloudflare/scripts/verify-db-migration.ts', `--base-dir=${repoDir}`, `--db-path=${dbPath}`])
}

async function setupTempRepo(): Promise<TempContext> {
	const repoDir = await mkdtemp(join(tmpdir(), 'content-migration-'))
	const dbDir = join(repoDir, 'data')
	const dbPath = join(dbDir, 'content.db')

	await mkdir(join(repoDir, 'src/config'), { recursive: true })
	await mkdir(join(repoDir, 'public/blogs/post-1'), { recursive: true })
	await mkdir(join(repoDir, 'public/blogs/post-2'), { recursive: true })
	await mkdir(join(repoDir, 'src/app/share'), { recursive: true })
	await mkdir(dbDir, { recursive: true })

	await writeFile(
		join(repoDir, 'src/config/site-content.json'),
		JSON.stringify({ meta: { title: 'Demo Site' }, theme: { colorBrand: '#fff' } }, null, 2)
	)
	await writeFile(
		join(repoDir, 'src/config/card-styles.json'),
		JSON.stringify({ artCard: { width: 100, height: 100, enabled: true } }, null, 2)
	)
	await writeFile(
		join(repoDir, 'public/blogs/index.json'),
		JSON.stringify(
			[
				{
					slug: 'post-2',
					title: 'Post Two',
					tags: ['tag-b'],
					date: '2026-01-02T00:00',
					summary: 'summary-2',
					cover: '/blogs/post-2/cover.png',
					hidden: false,
					category: '总结',
					favorite: false
				},
				{
					slug: 'post-1',
					title: 'Post One',
					tags: ['tag-a'],
					date: '2026-01-01T00:00',
					summary: 'summary-1',
					cover: '/blogs/post-1/cover.png',
					hidden: false,
					category: 'Cloudflare',
					favorite: false
				}
			],
			null,
			2
		)
	)
	await writeFile(join(repoDir, 'public/blogs/categories.json'), JSON.stringify({ categories: ['Cloudflare', '总结'] }, null, 2))
	await writeFile(join(repoDir, 'public/blogs/folders.json'), JSON.stringify([], null, 2))
	await writeFile(join(repoDir, 'public/blogs/post-1/config.json'), JSON.stringify({ pinned: true }, null, 2))
	await writeFile(join(repoDir, 'public/blogs/post-2/config.json'), JSON.stringify({ pinned: false }, null, 2))
	await writeFile(join(repoDir, 'public/blogs/post-1/index.md'), '# post 1 body')
	await writeFile(join(repoDir, 'public/blogs/post-2/index.md'), '# post 2 body')
	await writeFile(
		join(repoDir, 'src/app/share/list.json'),
		JSON.stringify(
			[
				{ name: 'Tool A', url: 'https://a.dev', logo: '/a.svg', description: 'desc-a', tags: ['工具'], stars: 4 },
				{ name: 'Tool B', url: 'https://b.dev', logo: '/b.svg', description: 'desc-b', tags: ['学习'], stars: 5 }
			],
			null,
			2
		)
	)

	return {
		repoDir,
		dbPath,
		cleanup: async () => rm(repoDir, { recursive: true, force: true })
	}
}

function buildConsistentBlogStorageRaw() {
	return JSON.stringify(
		{
			version: 1,
			updatedAt: '2026-04-15T00:00:00.000Z',
			blogs: {
				'post-2': {
					slug: 'post-2',
					title: 'Post Two',
					tags: ['tag-b'],
					date: '2026-01-02T00:00',
					summary: 'summary-2',
					cover: '/blogs/post-2/cover.png',
					hidden: false,
					category: '总结',
					favorite: false,
					status: 'published'
				},
				'post-1': {
					slug: 'post-1',
					title: 'Post One',
					tags: ['tag-a'],
					date: '2026-01-01T00:00',
					summary: 'summary-1',
					cover: '/blogs/post-1/cover.png',
					hidden: false,
					category: 'Cloudflare',
					favorite: false,
					status: 'published'
				}
			}
		},
		null,
		2
	)
}

async function writeConsistentBlogStorage(repoDir: string) {
	await writeFile(join(repoDir, 'public/blogs/storage.json'), buildConsistentBlogStorageRaw())
}

function parseVerifySummary(raw: string) {
	return JSON.parse(raw) as {
		ledger: { blogEntriesCount: number }
		verify: {
			artifactsToRebuild: string[]
			touchesMarkdown: boolean
			touchesImages: boolean
			atomic: boolean
		}
	}
}

function assertVerifyScriptFailure(error: unknown, expectedArtifactsToRebuild: string[]) {
	assert.equal(typeof error, 'object')
	assert.ok(error)
	const failure = error as { stdout: string; stderr: string }
	assert.doesNotMatch(failure.stderr, /ENOENT/)
	assert.match(failure.stderr, /博客正式产物与账本不一致/)
	assert.deepEqual(parseVerifySummary(failure.stdout).verify.artifactsToRebuild, expectedArtifactsToRebuild)
	return true
}

async function assertFileMissing(path: string) {
	await assert.rejects(() => access(path, constants.F_OK), (error: NodeJS.ErrnoException) => error.code === 'ENOENT')
}

async function createVerifiedRuntimeRepo() {
	const context = await setupTempRepo()
	await writeConsistentBlogStorage(context.repoDir)
	return context
}

test('legacy migration imports structured metadata and keeps markdown files unchanged', async () => {
	const context = await setupTempRepo()

	try {
		const db = createContentDb(context.dbPath)
		applyContentDbMigrations(db)
		db.close()

		const markdownBefore = await readFile(join(context.repoDir, 'public/blogs/post-1/index.md'), 'utf8')

		const firstRun = await migrateLegacyContentToDb({
			baseDir: context.repoDir,
			dbPath: context.dbPath,
			confirmOverwrite: true
		})

		assert.equal(firstRun.before.siteConfig, 0)
		assert.equal(firstRun.after.siteConfig, 1)
		assert.equal(firstRun.after.layoutConfig, 1)
		assert.equal(firstRun.after.blogEntries, 2)
		assert.equal(firstRun.after.shareEntries, 2)
		assert.deepEqual(firstRun.imported, {
			siteConfig: 1,
			layoutConfig: 1,
			blogEntries: 2,
			shareEntries: 2
		})

		const db2 = createContentDb(context.dbPath)
		const siteRow = db2.prepare('SELECT payload FROM site_config WHERE id = 1').get() as { payload: string }
		const layoutRow = db2.prepare('SELECT payload FROM layout_config WHERE id = 1').get() as { payload: string }
		const blogRow = db2.prepare('SELECT slug, metadata_json, body_path FROM blog_entries WHERE slug = ?').get('post-1') as {
			slug: string
			metadata_json: string
			body_path: string
		}
		const shareRow = db2.prepare('SELECT slug, metadata_json FROM share_entries WHERE slug = ?').get('tool-a') as {
			slug: string
			metadata_json: string
		}

		assert.equal(JSON.parse(siteRow.payload).meta.title, 'Demo Site')
		assert.equal(JSON.parse(layoutRow.payload).artCard.width, 100)
		assert.equal(blogRow.slug, 'post-1')
		assert.equal(blogRow.body_path, '/public/blogs/post-1/index.md')
		assert.equal(JSON.parse(blogRow.metadata_json).categories[0], 'Cloudflare')
		assert.equal(shareRow.slug, 'tool-a')
		assert.equal(JSON.parse(shareRow.metadata_json).url, 'https://a.dev')
		db2.close()

		assert.equal(await readFile(join(context.repoDir, 'public/blogs/post-1/index.md'), 'utf8'), markdownBefore)

		await assert.rejects(
			migrateLegacyContentToDb({
				baseDir: context.repoDir,
				dbPath: context.dbPath
			}),
			/already contains migrated data/
		)

		const secondRun = await migrateLegacyContentToDb({
			baseDir: context.repoDir,
			dbPath: context.dbPath,
			confirmOverwrite: true
		})
		assert.equal(secondRun.after.blogEntries, 2)
		assert.equal(secondRun.after.shareEntries, 2)
		assert.deepEqual(secondRun.imported, {
			siteConfig: 1,
			layoutConfig: 1,
			blogEntries: 2,
			shareEntries: 2
		})

		const dryRun = await migrateLegacyContentToDb({
			baseDir: context.repoDir,
			dbPath: context.dbPath,
			dryRun: true
		})
		assert.equal(dryRun.dryRun, true)
		assert.equal(dryRun.before.blogEntries, 2)
		assert.equal(dryRun.after.blogEntries, 2)
	} finally {
		await context.cleanup()
	}
})

test('legacy migration dry-run does not create a missing database file', async () => {
	const context = await setupTempRepo()

	try {
		await assertFileMissing(context.dbPath)

		const dryRun = await migrateLegacyContentToDb({
			baseDir: context.repoDir,
			dbPath: context.dbPath,
			dryRun: true
		})

		assert.equal(dryRun.dryRun, true)
		assert.deepEqual(dryRun.before, { siteConfig: 0, layoutConfig: 0, blogEntries: 0, shareEntries: 0 })
		assert.deepEqual(dryRun.after, dryRun.before)
		assert.equal(dryRun.imported.blogEntries, 2)
		assert.equal(dryRun.imported.shareEntries, 2)
		await assertFileMissing(context.dbPath)
	} finally {
		await context.cleanup()
	}
})

test('legacy migration prefers public share storage over stale source list and preserves ledger fields', async () => {
	const context = await setupTempRepo()

	try {
		await mkdir(join(context.repoDir, 'public/share'), { recursive: true })
		await writeFile(
			join(context.repoDir, 'public/share/storage.json'),
			JSON.stringify(
				{
					version: 1,
					updatedAt: '2026-04-15T00:00:00.000Z',
					shares: {
						'fresh-tool': {
							slug: 'fresh-tool',
							name: 'Fresh Tool',
							logo: '/fresh.svg',
							url: 'https://fresh.dev',
							description: 'fresh share from storage',
							tags: ['fresh'],
							stars: 7,
							category: '新分类',
							folderPath: '/收藏/工具',
							status: 'archived'
						}
					}
				},
				null,
				2
			)
		)

		const result = await migrateLegacyContentToDb({
			baseDir: context.repoDir,
			dbPath: context.dbPath,
			confirmOverwrite: true
		})

		assert.equal(result.after.shareEntries, 1)
		assert.equal(result.imported.shareEntries, 1)

		const db = createContentDb(context.dbPath)
		const freshRow = db.prepare('SELECT slug, title, status, category_key, folder_key, metadata_json FROM share_entries WHERE slug = ?').get('fresh-tool') as {
			slug: string
			title: string
			status: string
			category_key: string | null
			folder_key: string | null
			metadata_json: string
		}
		const staleRow = db.prepare('SELECT slug FROM share_entries WHERE slug = ?').get('tool-a') as { slug: string } | undefined

		assert.equal(freshRow.slug, 'fresh-tool')
		assert.equal(freshRow.title, 'Fresh Tool')
		assert.equal(freshRow.status, 'archived')
		assert.equal(freshRow.category_key, '新分类')
		assert.equal(freshRow.folder_key, '/收藏/工具')
		assert.equal(JSON.parse(freshRow.metadata_json).url, 'https://fresh.dev')
		assert.equal(staleRow, undefined)
		db.close()
	} finally {
		await context.cleanup()
	}
})

test('legacy migration prefers public blog storage over stale index and preserves ledger fields', async () => {
	const context = await setupTempRepo()

	try {
		await writeFile(
			join(context.repoDir, 'public/blogs/storage.json'),
			JSON.stringify(
				{
					version: 1,
					updatedAt: '2026-04-15T00:00:00.000Z',
					blogs: {
						'fresh-blog': {
							slug: 'fresh-blog',
							title: 'Fresh Blog',
							tags: ['fresh'],
							date: '2026-04-15T00:00:00.000Z',
							summary: 'fresh summary',
							cover: '/blogs/fresh-blog/cover.png',
							hidden: true,
							category: '新分类',
							folderPath: '/写作/迁移',
							favorite: true,
							status: 'archived'
						}
					}
				},
				null,
				2
			)
		)

		const result = await migrateLegacyContentToDb({
			baseDir: context.repoDir,
			dbPath: context.dbPath,
			confirmOverwrite: true
		})

		assert.equal(result.after.blogEntries, 1)
		assert.equal(result.imported.blogEntries, 1)

		const db = createContentDb(context.dbPath)
		const freshRow = db.prepare('SELECT slug, title, status, category_key, folder_key, metadata_json, body_path FROM blog_entries WHERE slug = ?').get('fresh-blog') as {
			slug: string
			title: string
			status: string
			category_key: string | null
			folder_key: string | null
			metadata_json: string
			body_path: string | null
		}
		const staleRow = db.prepare('SELECT slug FROM blog_entries WHERE slug = ?').get('post-1') as { slug: string } | undefined

		assert.equal(freshRow.slug, 'fresh-blog')
		assert.equal(freshRow.title, 'Fresh Blog')
		assert.equal(freshRow.status, 'archived')
		assert.equal(freshRow.category_key, '新分类')
		assert.equal(freshRow.folder_key, '/写作/迁移')
		assert.equal(freshRow.body_path, null)
		assert.equal(JSON.parse(freshRow.metadata_json).storage.favorite, true)
		assert.equal(staleRow, undefined)
		db.close()
	} finally {
		await context.cleanup()
	}
})

test('legacy migration fails when blog index references a missing directory', async () => {
	const context = await setupTempRepo()

	try {
		await rm(join(context.repoDir, 'public/blogs/post-2'), { recursive: true, force: true })

		await assert.rejects(
			migrateLegacyContentToDb({
				baseDir: context.repoDir,
				dbPath: context.dbPath,
				confirmOverwrite: true
			}),
			/missing blog directory/
		)
	} finally {
		await context.cleanup()
	}
})

test('verify migration script succeeds when runtime artifacts already agree with ledger', async () => {
	const context = await createVerifiedRuntimeRepo()

	try {
		const result = await runVerifyScript(context.repoDir, context.dbPath)
		const summary = parseVerifySummary(result.stdout)

		assert.equal(summary.ledger.blogEntriesCount, 2)
		assert.deepEqual(summary.verify.artifactsToRebuild, [])
		assert.equal(summary.verify.touchesMarkdown, false)
		assert.equal(summary.verify.touchesImages, false)
		assert.equal(summary.verify.atomic, true)
	} finally {
		await context.cleanup()
	}
})

test('verify migration script fails with rebuild summary when storage.json is missing', async () => {
	const context = await setupTempRepo()

	try {
		await assert.rejects(
			runVerifyScript(context.repoDir, context.dbPath),
			(error) => assertVerifyScriptFailure(error, ['public/blogs/storage.json'])
		)
		await assert.rejects(readFile(join(context.repoDir, 'public/blogs/storage.json'), 'utf8'), /ENOENT/)
	} finally {
		await context.cleanup()
	}
})

test('verify migration script reports categories drift without mutating runtime artifacts', async () => {
	const context = await createVerifiedRuntimeRepo()

	try {
		await writeFile(join(context.repoDir, 'public/blogs/categories.json'), JSON.stringify({ categories: ['错位分类'] }, null, 2))

		await assert.rejects(
			runVerifyScript(context.repoDir, context.dbPath),
			(error) => assertVerifyScriptFailure(error, ['public/blogs/categories.json'])
		)
		assert.deepEqual(JSON.parse(await readFile(join(context.repoDir, 'public/blogs/categories.json'), 'utf8')), {
			categories: ['错位分类']
		})
	} finally {
		await context.cleanup()
	}
})
