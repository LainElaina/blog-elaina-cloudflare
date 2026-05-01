import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolve } from 'node:path'
import { isPathInsideDirectory, isPathMatchingFileOrInsideDirectory, isPathStrictlyInsideDirectory } from './local-path.ts'

test('local path containment rejects sibling paths that only share a prefix', () => {
	const projectDir = resolve('/repo/blog')
	const publicDir = resolve(projectDir, 'public')

	assert.equal(isPathInsideDirectory(publicDir, resolve(projectDir, 'public/image.png')), true)
	assert.equal(isPathInsideDirectory(publicDir, resolve(projectDir, 'public-assets/image.png')), false)
	assert.equal(isPathInsideDirectory(projectDir, resolve('/repo/blog-backup/file.txt')), false)
})

test('strict local path containment rejects directory roots', () => {
	const projectDir = resolve('/repo/blog')
	const publicDir = resolve(projectDir, 'public')
	const blogsDir = resolve(publicDir, 'blogs')

	assert.equal(isPathStrictlyInsideDirectory(blogsDir, resolve(blogsDir, 'post-a')), true)
	assert.equal(isPathStrictlyInsideDirectory(blogsDir, blogsDir), false)
	assert.equal(isPathStrictlyInsideDirectory(blogsDir, publicDir), false)
	assert.equal(isPathStrictlyInsideDirectory(blogsDir, resolve(projectDir, 'public-assets/post-a')), false)
})

test('path matching helper allows exact file matches and directory descendants only', () => {
	const projectDir = resolve('/repo/blog')
	const blogsDir = resolve(projectDir, 'public/blogs')
	const indexFile = resolve(blogsDir, 'index.json')

	assert.equal(isPathMatchingFileOrInsideDirectory(indexFile, indexFile), true)
	assert.equal(isPathMatchingFileOrInsideDirectory(blogsDir, resolve(blogsDir, 'post-a/index.md')), true)
	assert.equal(isPathMatchingFileOrInsideDirectory(blogsDir, blogsDir), true)
	assert.equal(isPathMatchingFileOrInsideDirectory(blogsDir, resolve(projectDir, 'public/blogs-backup/post-a/index.md')), false)
	assert.equal(isPathMatchingFileOrInsideDirectory(indexFile, resolve(blogsDir, 'index.json.bak')), false)
})
