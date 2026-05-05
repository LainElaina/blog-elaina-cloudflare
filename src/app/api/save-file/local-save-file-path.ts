import { resolve } from 'path'
import { isPathStrictlyInsideDirectory } from '../local-path.ts'

const ALLOWED_SAVE_FILE_PATHS = [
	'src/app/about/list.json',
	'src/app/bloggers/list.json',
	'src/app/pictures/list.json',
	'src/app/projects/list.json',
	'src/app/snippets/list.json',
	'public/blogs/index.json',
	'public/blogs/categories.json',
	'public/blogs/folders.json',
	'public/blogs/storage.json',
	'public/share/list.json',
	'public/share/categories.json',
	'public/share/folders.json',
	'public/share/storage.json'
]

const ALLOWED_SAVE_FILE_DIRECTORIES = ['public/blogs']

export function isAllowedSaveFilePath(projectDir: string, fullPath: string) {
	return (
		ALLOWED_SAVE_FILE_PATHS.some(allowedPath => resolve(projectDir, allowedPath) === fullPath) ||
		ALLOWED_SAVE_FILE_DIRECTORIES.some(allowedDir => isPathStrictlyInsideDirectory(resolve(projectDir, allowedDir), fullPath))
	)
}
