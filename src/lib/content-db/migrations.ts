import type { ContentDb } from './client.ts'
import { INITIAL_CONTENT_DB_MIGRATION_NAME, INITIAL_CONTENT_DB_MIGRATION_VERSION, INITIAL_CONTENT_DB_STATEMENTS } from './schema.ts'

type TableRow = { name: string }
type ColumnRow = { name: string }
type TableInfoRow = { name: string; notnull: number; dflt_value: string | null }
type MigrationRow = { version: number }

const DRAFT_ITEMS_BASELINE_COLUMN_UPGRADE_VERSION = 2
const DRAFT_ITEMS_BASELINE_COLUMN_UPGRADE_NAME = 'draft_items_task3_columns_upgrade'
const DRAFT_ITEMS_CONSTRAINTS_UPGRADE_VERSION = 3
const DRAFT_ITEMS_CONSTRAINTS_UPGRADE_NAME = 'draft_items_task3_constraints_upgrade'

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

		const appliedDraftItemsConstraintUpgrade = db
			.prepare('SELECT version FROM schema_migrations WHERE version = ?')
			.get(DRAFT_ITEMS_CONSTRAINTS_UPGRADE_VERSION) as MigrationRow | undefined

		if (!appliedDraftItemsConstraintUpgrade) {
			upgradeDraftItemsTask3Constraints(db)
			db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(
				DRAFT_ITEMS_CONSTRAINTS_UPGRADE_VERSION,
				DRAFT_ITEMS_CONSTRAINTS_UPGRADE_NAME
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

function upgradeDraftItemsTask3Constraints(db: ContentDb): void {
	const draftItemsInfo = listTableInfo(db, 'draft_items')
	const createdAtColumn = draftItemsInfo.find((column) => column.name === 'created_at')
	const createdAtNeedsRebuild =
		!createdAtColumn || createdAtColumn.notnull !== 1 || normalizeSqlDefault(createdAtColumn.dflt_value) !== 'CURRENT_TIMESTAMP'

	if (createdAtNeedsRebuild) {
		rebuildDraftItemsTable(db)
	}
}

function rebuildDraftItemsTable(db: ContentDb): void {
	db.exec(`CREATE TABLE draft_items__task3_upgrade (
		id TEXT PRIMARY KEY,
		entity_type TEXT NOT NULL,
		entity_key TEXT NOT NULL,
		status TEXT NOT NULL,
		manifest_json TEXT NOT NULL DEFAULT '{}',
		base_version TEXT,
		last_error TEXT,
		error_code TEXT,
		error_at TEXT,
		created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
	)`)
	db.exec(`INSERT INTO draft_items__task3_upgrade (
		id,
		entity_type,
		entity_key,
		status,
		manifest_json,
		base_version,
		last_error,
		error_code,
		error_at,
		created_at,
		updated_at
	)
	SELECT
		id,
		entity_type,
		entity_key,
		status,
		COALESCE(manifest_json, '{}'),
		base_version,
		last_error,
		error_code,
		error_at,
		COALESCE(created_at, updated_at, CURRENT_TIMESTAMP),
		COALESCE(updated_at, CURRENT_TIMESTAMP)
	FROM draft_items`)
	db.exec('DROP TABLE draft_items')
	db.exec('ALTER TABLE draft_items__task3_upgrade RENAME TO draft_items')
	db.exec('CREATE UNIQUE INDEX IF NOT EXISTS draft_items_entity_key_idx ON draft_items(entity_type, entity_key)')
}

export function listContentDbTables(db: ContentDb): string[] {
	return (db
		.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
		.all() as TableRow[]).map((row) => row.name)
}

function normalizeSqlDefault(value: string | null): string | null {
	return value?.replace(/^\((.*)\)$/, '$1') ?? null
}

function listTableInfo(db: ContentDb, tableName: string): TableInfoRow[] {
	return db.prepare(`PRAGMA table_info(${tableName})`).all() as TableInfoRow[]
}

export function listTableColumns(db: ContentDb, tableName: string): string[] {
	return listTableInfo(db, tableName).map((row) => row.name)
}
