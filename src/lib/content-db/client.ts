import { mkdirSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { dirname, resolve } from 'node:path'

export type ContentDb = DatabaseSync

export function getDefaultContentDbPath(baseDir: string = process.cwd()): string {
	return resolve(baseDir, 'data/content.db')
}

export function createContentDb(dbPath: string = getDefaultContentDbPath()): ContentDb {
	if (dbPath !== ':memory:') {
		mkdirSync(dirname(dbPath), { recursive: true })
	}
	return new DatabaseSync(dbPath)
}
