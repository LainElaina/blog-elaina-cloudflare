import { resolve } from 'path'
import { assertSafeBlogSlug } from '../../write/services/blog-slug.ts'
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

const ALLOWED_BLOG_POST_FILENAMES = new Set(['index.md', 'config.json'])

function isAllowedBlogPostFilePath(projectDir: string, fullPath: string) {
	const blogsDir = resolve(projectDir, 'public/blogs')
	if (!isPathStrictlyInsideDirectory(blogsDir, fullPath)) {
		return false
	}

	const relativePath = fullPath.slice(blogsDir.length + 1).replace(/\\/g, '/')
	const parts = relativePath.split('/')
	if (parts.length !== 2 || !ALLOWED_BLOG_POST_FILENAMES.has(parts[1])) {
		return false
	}

	try {
		assertSafeBlogSlug(parts[0])
		return true
	} catch {
		return false
	}
}

export function isAllowedSaveFilePath(projectDir: string, fullPath: string) {
	return ALLOWED_SAVE_FILE_PATHS.some(allowedPath => resolve(projectDir, allowedPath) === fullPath) || isAllowedBlogPostFilePath(projectDir, fullPath)
}
