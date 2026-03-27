export const INITIAL_CONTENT_DB_MIGRATION_VERSION = 1
export const INITIAL_CONTENT_DB_MIGRATION_NAME = 'initial_content_schema'

export const INITIAL_CONTENT_DB_STATEMENTS = [
	`CREATE TABLE IF NOT EXISTS schema_migrations (
		version INTEGER PRIMARY KEY,
		name TEXT NOT NULL,
		applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
	)`,
	`CREATE TABLE IF NOT EXISTS site_config (
		id INTEGER PRIMARY KEY CHECK (id = 1),
		payload TEXT NOT NULL,
		updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
	)`,
	`CREATE TABLE IF NOT EXISTS layout_config (
		id INTEGER PRIMARY KEY CHECK (id = 1),
		payload TEXT NOT NULL,
		updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
	)`,
	`CREATE TABLE IF NOT EXISTS blog_entries (
		id TEXT PRIMARY KEY,
		slug TEXT NOT NULL UNIQUE,
		title TEXT NOT NULL,
		status TEXT NOT NULL DEFAULT 'published',
		category_key TEXT,
		folder_key TEXT,
		metadata_json TEXT NOT NULL DEFAULT '{}',
		body_path TEXT,
		created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
	)`,
	`CREATE TABLE IF NOT EXISTS share_entries (
		id TEXT PRIMARY KEY,
		slug TEXT NOT NULL UNIQUE,
		title TEXT NOT NULL,
		status TEXT NOT NULL DEFAULT 'published',
		category_key TEXT,
		folder_key TEXT,
		metadata_json TEXT NOT NULL DEFAULT '{}',
		created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
	)`,
	`CREATE TABLE IF NOT EXISTS draft_items (
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
	)`,
	`CREATE UNIQUE INDEX IF NOT EXISTS draft_items_entity_key_idx ON draft_items(entity_type, entity_key)`,
	`CREATE TABLE IF NOT EXISTS content_versions (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		entity_type TEXT NOT NULL,
		entity_key TEXT NOT NULL,
		version_hash TEXT NOT NULL,
		source TEXT NOT NULL,
		created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
	)`,
	`CREATE INDEX IF NOT EXISTS content_versions_entity_idx ON content_versions(entity_type, entity_key)`
] as const
