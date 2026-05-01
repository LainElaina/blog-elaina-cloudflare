import { isAbsolute, relative, resolve } from 'path'

export function isPathInsideDirectory(baseDir: string, targetPath: string) {
	const resolvedBaseDir = resolve(baseDir)
	const resolvedTargetPath = resolve(targetPath)
	const relativePath = relative(resolvedBaseDir, resolvedTargetPath)

	return relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath))
}

export function isPathStrictlyInsideDirectory(baseDir: string, targetPath: string) {
	const resolvedBaseDir = resolve(baseDir)
	const resolvedTargetPath = resolve(targetPath)
	const relativePath = relative(resolvedBaseDir, resolvedTargetPath)

	return relativePath !== '' && !relativePath.startsWith('..') && !isAbsolute(relativePath)
}
