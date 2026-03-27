import type { ContentDb } from './client.ts'
import { INITIAL_CONTENT_DB_MIGRATION_NAME, INITIAL_CONTENT_DB_MIGRATION_VERSION, INITIAL_CONTENT_DB_STATEMENTS } from './schema.ts'

type TableRow = { name: string }
type ColumnRow = { name: string }
type MigrationRow = { version: number }

const DRAFT_ITEMS_BASELINE_COLUMN_UPGRADE_VERSION = 2
const DRAFT_ITEMS_BASELINE_COLUMN_UPGRADE_NAME = 'draft_items_task3_columns_upgrade'

export function applyContentDbMigrations(db: ContentDb): void {
	db.exec('BEGIN')

	try {
		db.exec(INITIAL_CONTENT_DB_STATEMENTS[0])

		const appliedInitialMigration = db
			.prepare('SELECT version FROM schema_migrations WHERE version = ?')
			.get(INITIAL_CONTENT_DB_MIGRATION_VERSION) as MigrationRow | undefined

		if (!appliedInitialMigration) {
			for (const statement of INITIAL_CONTENT_DB_STATEMENTS.slice(1)) {
				db.exec(statement)
			}

			db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(INITIAL_CONTENT_DB_MIGRATION_VERSION, INITIAL_CONTENT_DB_MIGRATION_NAME)
		}

		const appliedDraftItemsUpgrade = db
			.prepare('SELECT version FROM schema_migrations WHERE version = ?')
			.get(DRAFT_ITEMS_BASELINE_COLUMN_UPGRADE_VERSION) as MigrationRow | undefined

		if (!appliedDraftItemsUpgrade) {
			upgradeDraftItemsTask3Columns(db)
			db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(
				DRAFT_ITEMS_BASELINE_COLUMN_UPGRADE_VERSION,
				DRAFT_ITEMS_BASELINE_COLUMN_UPGRADE_NAME
			)
		}

		db.exec('COMMIT')
	} catch (error) {
		db.exec('ROLLBACK')
		throw error
	}
}

function upgradeDraftItemsTask3Columns(db: ContentDb): void {
	const columns = new Set(listTableColumns(db, 'draft_items'))

	if (!columns.has('error_code')) {
		db.exec('ALTER TABLE draft_items ADD COLUMN error_code TEXT')
	}

	if (!columns.has('error_at')) {
		db.exec('ALTER TABLE draft_items ADD COLUMN error_at TEXT')
	}

	if (!columns.has('created_at')) {
		db.exec('ALTER TABLE draft_items ADD COLUMN created_at TEXT')
		db.exec("UPDATE draft_items SET created_at = COALESCE(created_at, updated_at, CURRENT_TIMESTAMP)")
	}
}

export function listContentDbTables(db: ContentDb): string[] {
	return (db
		.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
		.all() as TableRow[]).map((row) => row.name)
}

export function listTableColumns(db: ContentDb, tableName: string): string[] {
	return (db.prepare(`PRAGMA table_info(${tableName})`).all() as ColumnRow[]).map((row) => row.name)
}
