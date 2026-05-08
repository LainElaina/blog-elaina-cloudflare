import { relative, resolve } from 'path'
import type { LocalContentMutationScope } from './local-content-mutation-lock.ts'
import { isPathStrictlyInsideDirectory } from './local-path.ts'
import { assertSafeBlogSlug } from '../write/services/blog-slug.ts'

const ALLOWED_EXACT_UPLOAD_IMAGE_PATHS = ['public/favicon.png', 'public/images/avatar.png']
const ALLOWED_DIRECT_UPLOAD_IMAGE_DIRECTORIES = [
	'public/images/art',
	'public/images/background',
	'public/images/blogger',
	'public/images/custom-components',
	'public/images/pictures',
	'public/images/project',
	'public/images/share',
	'public/images/social-buttons'
]

function isSafeUploadedImageFilename(filename: string) {
	return Boolean(filename) && !filename.includes('/') && !filename.includes('\\') && !filename.includes('..')
}

function isDirectChildFilePath(baseDir: string, fullPath: string) {
	if (!isPathStrictlyInsideDirectory(baseDir, fullPath)) {
		return false
	}

	return isSafeUploadedImageFilename(relative(baseDir, fullPath))
}

function isAllowedBlogImagePath(projectDir: string, fullPath: string) {
	const blogsDir = resolve(projectDir, 'public/blogs')
	if (!isPathStrictlyInsideDirectory(blogsDir, fullPath)) {
		return false
	}

	const relativePath = relative(blogsDir, fullPath).replace(/\\/g, '/')
	const parts = relativePath.split('/')
	if (parts.length !== 2 || !isSafeUploadedImageFilename(parts[1])) {
		return false
	}

	try {
		assertSafeBlogSlug(parts[0])
		return true
	} catch {
		return false
	}
}

export function isAllowedLocalUploadImagePath(projectDir: string, fullPath: string) {
	return (
		ALLOWED_EXACT_UPLOAD_IMAGE_PATHS.some(allowedPath => resolve(projectDir, allowedPath) === fullPath) ||
		ALLOWED_DIRECT_UPLOAD_IMAGE_DIRECTORIES.some(allowedDir => isDirectChildFilePath(resolve(projectDir, allowedDir), fullPath)) ||
		isAllowedBlogImagePath(projectDir, fullPath)
	)
}

export function getLocalUploadImageMutationScope(projectDir: string, fullPath: string): LocalContentMutationScope | null {
	if (isAllowedBlogImagePath(projectDir, fullPath)) {
		return 'blog'
	}
	if (isDirectChildFilePath(resolve(projectDir, 'public/images/share'), fullPath)) {
		return 'share'
	}
	return null
}
