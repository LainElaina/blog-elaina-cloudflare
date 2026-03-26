import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
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
					slug: 'post-1',
					title: 'Post One',
					tags: ['tag-a'],
					date: '2026-01-01T00:00',
					summary: 'summary-1',
					cover: '/blogs/post-1/cover.png',
					hidden: false,
					category: 'Cloudflare'
				},
				{
					slug: 'post-2',
					title: 'Post Two',
					tags: ['tag-b'],
					date: '2026-01-02T00:00',
					summary: 'summary-2',
					cover: '/blogs/post-2/cover.png',
					hidden: false,
					category: '总结'
				}
			],
			null,
			2
		)
	)
	await writeFile(join(repoDir, 'public/blogs/categories.json'), JSON.stringify({ categories: ['Cloudflare', '总结'] }, null, 2))
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

test('verify migration script succeeds for a healthy migrated repository', async () => {
	const context = await setupTempRepo()

	try {
		await migrateLegacyContentToDb({
			baseDir: context.repoDir,
			dbPath: context.dbPath,
			confirmOverwrite: true
		})

		const result = await runVerifyScript(context.repoDir, context.dbPath)
		const summary = JSON.parse(result.stdout) as {
			database: { blogEntriesCount: number; shareEntriesCount: number }
			keyRecords: { missingBlogSlugs: string[]; missingShareSlugs: string[] }
		}

		assert.equal(summary.database.blogEntriesCount, 2)
		assert.equal(summary.database.shareEntriesCount, 2)
		assert.deepEqual(summary.keyRecords.missingBlogSlugs, [])
		assert.deepEqual(summary.keyRecords.missingShareSlugs, [])
	} finally {
		await context.cleanup()
	}
})

test('verify migration script fails when migrated blog body path no longer matches legacy source', async () => {
	const context = await setupTempRepo()

	try {
		await migrateLegacyContentToDb({
			baseDir: context.repoDir,
			dbPath: context.dbPath,
			confirmOverwrite: true
		})

		const db = createContentDb(context.dbPath)
		db.prepare('UPDATE blog_entries SET body_path = ? WHERE slug = ?').run('/public/blogs/post-1/wrong.md', 'post-1')
		db.close()

		await assert.rejects(runVerifyScript(context.repoDir, context.dbPath), /关键记录校验失败|内容映射校验失败/)
	} finally {
		await context.cleanup()
	}
})
