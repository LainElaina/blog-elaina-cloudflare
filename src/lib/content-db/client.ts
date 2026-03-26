import { DatabaseSync } from 'node:sqlite'
import { resolve } from 'node:path'

export type ContentDb = DatabaseSync

export function getDefaultContentDbPath(baseDir: string = process.cwd()): string {
	return resolve(baseDir, 'data/content.db')
}

export function createContentDb(dbPath: string = getDefaultContentDbPath()): ContentDb {
	return new DatabaseSync(dbPath)
}
