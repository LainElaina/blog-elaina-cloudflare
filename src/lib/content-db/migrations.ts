import type { ContentDb } from './client.ts'
import { INITIAL_CONTENT_DB_MIGRATION_NAME, INITIAL_CONTENT_DB_MIGRATION_VERSION, INITIAL_CONTENT_DB_STATEMENTS } from './schema.ts'

type TableRow = { name: string }
type ColumnRow = { name: string }
type MigrationRow = { version: number }

export function applyContentDbMigrations(db: ContentDb): void {
	db.exec('BEGIN')

	try {
		db.exec(INITIAL_CONTENT_DB_STATEMENTS[0])

		const appliedMigration = db
			.prepare('SELECT version FROM schema_migrations WHERE version = ?')
			.get(INITIAL_CONTENT_DB_MIGRATION_VERSION) as MigrationRow | undefined

		if (!appliedMigration) {
			for (const statement of INITIAL_CONTENT_DB_STATEMENTS.slice(1)) {
				db.exec(statement)
			}

			db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(INITIAL_CONTENT_DB_MIGRATION_VERSION, INITIAL_CONTENT_DB_MIGRATION_NAME)
		}

		db.exec('COMMIT')
	} catch (error) {
		db.exec('ROLLBACK')
		throw error
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
