import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

const { createContentDb, getDefaultContentDbPath } = await import(new URL('./client.ts', import.meta.url).href)
const { applyContentDbMigrations, listContentDbTables, listTableColumns } = await import(new URL('./migrations.ts', import.meta.url).href)

const requiredTables = ['site_config', 'layout_config', 'blog_entries', 'share_entries', 'draft_items', 'content_versions']

async function withTempDb(run: (dbPath: string) => void) {
	const tempDir = await mkdtemp(join(tmpdir(), 'content-db-'))
	const dbPath = join(tempDir, 'content.db')

	try {
		await run(dbPath)
	} finally {
		await rm(tempDir, { recursive: true, force: true })
	}
}

test('initial content database schema creates required tables', async () => {
	await withTempDb((dbPath) => {
		const db = createContentDb(dbPath)

		try {
			applyContentDbMigrations(db)

			const tables = listContentDbTables(db)

			assert.deepEqual(new Set(tables.filter((table) => requiredTables.includes(table))), new Set(requiredTables))
		} finally {
			db.close()
		}
	})
})

test('content database schema reserves classification fields for blog and share entries', async () => {
	await withTempDb((dbPath) => {
		const db = createContentDb(dbPath)

		try {
			applyContentDbMigrations(db)

			assert.deepEqual(listTableColumns(db, 'blog_entries').filter((column) => ['category_key', 'folder_key'].includes(column)), ['category_key', 'folder_key'])
			assert.deepEqual(listTableColumns(db, 'share_entries').filter((column) => ['category_key', 'folder_key'].includes(column)), ['category_key', 'folder_key'])
		} finally {
			db.close()
		}
	})
})

test('content database client defaults to repository data/content.db path', () => {
	assert.equal(getDefaultContentDbPath('/app/blog-elaina-cloudflare'), resolve('/app/blog-elaina-cloudflare', 'data/content.db'))
})

test('applying content database migrations twice stays idempotent', async () => {
	await withTempDb((dbPath) => {
		const db = createContentDb(dbPath)

		try {
			applyContentDbMigrations(db)
			applyContentDbMigrations(db)

			const migrationRows = (db.prepare('SELECT version, name FROM schema_migrations ORDER BY version').all() as Array<{ version: number; name: string }>).map((row) => ({
				version: row.version,
				name: row.name
			}))

			assert.deepEqual(migrationRows, [{ version: 1, name: 'initial_content_schema' }])
		} finally {
			db.close()
		}
	})
})
