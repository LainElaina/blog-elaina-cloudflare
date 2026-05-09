import { resolve } from 'path'
import { assertSafeBlogSlug } from '../../write/services/blog-slug.ts'
import type { LocalContentMutationScope } from '../local-content-mutation-lock.ts'
import { isPathStrictlyInsideDirectory } from '../local-path.ts'

const BLOG_CONTENT_SAVE_FILE_PATHS = [
	'public/blogs/index.json',
	'public/blogs/categories.json',
	'public/blogs/folders.json',
	'public/blogs/storage.json'
]

const SHARE_CONTENT_SAVE_FILE_PATHS = [
	'public/share/list.json',
	'public/share/categories.json',
	'public/share/folders.json',
	'public/share/storage.json'
]

const CONTENT_SAVE_FILE_PATHS = [
	'src/app/about/list.json',
	'src/app/bloggers/list.json',
	'src/app/pictures/list.json',
	'src/app/projects/list.json',
	'src/app/snippets/list.json'
]

const ALLOWED_SAVE_FILE_PATHS = [
	...CONTENT_SAVE_FILE_PATHS,
	...BLOG_CONTENT_SAVE_FILE_PATHS,
	...SHARE_CONTENT_SAVE_FILE_PATHS
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

export function getSaveFileLocalContentMutationScope(projectDir: string, fullPath: string): LocalContentMutationScope | null {
	if (BLOG_CONTENT_SAVE_FILE_PATHS.some(allowedPath => resolve(projectDir, allowedPath) === fullPath) || isAllowedBlogPostFilePath(projectDir, fullPath)) {
		return 'blog'
	}
	if (SHARE_CONTENT_SAVE_FILE_PATHS.some(allowedPath => resolve(projectDir, allowedPath) === fullPath)) {
		return 'share'
	}
	if (CONTENT_SAVE_FILE_PATHS.some(allowedPath => resolve(projectDir, allowedPath) === fullPath)) {
		return 'content'
	}
	return null
}

export function isAllowedSaveFilePath(projectDir: string, fullPath: string) {
	return ALLOWED_SAVE_FILE_PATHS.some(allowedPath => resolve(projectDir, allowedPath) === fullPath) || isAllowedBlogPostFilePath(projectDir, fullPath)
}
