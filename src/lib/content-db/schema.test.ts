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

test('draft_items table includes draft/formal state-machine columns', async () => {
	await withTempDb((dbPath) => {
		const db = createContentDb(dbPath)

		try {
			applyContentDbMigrations(db)

			const columns = listTableColumns(db, 'draft_items')
			assert.deepEqual(
				columns.filter((column) => ['base_version', 'status', 'last_error', 'error_code', 'error_at', 'created_at', 'updated_at'].includes(column)),
				['status', 'base_version', 'last_error', 'error_code', 'error_at', 'created_at', 'updated_at']
			)
		} finally {
			db.close()
		}
	})
})

test('content database client defaults to repository data/content.db path', () => {
	assert.equal(getDefaultContentDbPath('/app/blog-elaina-cloudflare'), resolve('/app/blog-elaina-cloudflare', 'data/content.db'))
})

test('migrations upgrade legacy draft_items table to include Task 3 columns', async () => {
	await withTempDb((dbPath) => {
		const db = createContentDb(dbPath)

		try {
			db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
				version INTEGER PRIMARY KEY,
				name TEXT NOT NULL,
				applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
			)`)
			db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(1, 'initial_content_schema')
			db.exec(`CREATE TABLE IF NOT EXISTS draft_items (
				id TEXT PRIMARY KEY,
				entity_type TEXT NOT NULL,
				entity_key TEXT NOT NULL,
				status TEXT NOT NULL,
				manifest_json TEXT NOT NULL DEFAULT '{}',
				base_version TEXT,
				last_error TEXT,
				updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
			)`)

			applyContentDbMigrations(db)

			const columns = listTableColumns(db, 'draft_items')
			assert.equal(columns.includes('error_code'), true)
			assert.equal(columns.includes('error_at'), true)
			assert.equal(columns.includes('created_at'), true)

			const tableInfo = db.prepare('PRAGMA table_info(draft_items)').all() as Array<{ name: string; notnull: number; dflt_value: string | null }>
			const createdAt = tableInfo.find((column) => column.name === 'created_at')
			assert.equal(createdAt?.notnull, 1)
			assert.equal(createdAt?.dflt_value, 'CURRENT_TIMESTAMP')
		} finally {
			db.close()
		}
	})
})

test('migrations repair Task 3 created_at constraints even after column upgrade was already recorded', async () => {
	await withTempDb((dbPath) => {
		const db = createContentDb(dbPath)

		try {
			db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
				version INTEGER PRIMARY KEY,
				name TEXT NOT NULL,
				applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
			)`)
			db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(1, 'initial_content_schema')
			db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(2, 'draft_items_task3_columns_upgrade')
			db.exec(`CREATE TABLE IF NOT EXISTS draft_items (
				id TEXT PRIMARY KEY,
				entity_type TEXT NOT NULL,
				entity_key TEXT NOT NULL,
				status TEXT NOT NULL,
				manifest_json TEXT NOT NULL DEFAULT '{}',
				base_version TEXT,
				last_error TEXT,
				error_code TEXT,
				error_at TEXT,
				created_at TEXT,
				updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
			)`)

			applyContentDbMigrations(db)

			const tableInfo = db.prepare('PRAGMA table_info(draft_items)').all() as Array<{ name: string; notnull: number; dflt_value: string | null }>
			const createdAt = tableInfo.find((column) => column.name === 'created_at')
			assert.equal(createdAt?.notnull, 1)
			assert.equal(createdAt?.dflt_value, 'CURRENT_TIMESTAMP')
		} finally {
			db.close()
		}
	})
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

			assert.deepEqual(migrationRows, [
				{ version: 1, name: 'initial_content_schema' },
				{ version: 2, name: 'draft_items_task3_columns_upgrade' },
				{ version: 3, name: 'draft_items_task3_constraints_upgrade' }
			])
		} finally {
			db.close()
		}
	})
})
