import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolve } from 'node:path'
import { isPathInsideDirectory } from './local-path.ts'

test('local path containment rejects sibling paths that only share a prefix', () => {
	const projectDir = resolve('/repo/blog')
	const publicDir = resolve(projectDir, 'public')

	assert.equal(isPathInsideDirectory(publicDir, resolve(projectDir, 'public/image.png')), true)
	assert.equal(isPathInsideDirectory(publicDir, resolve(projectDir, 'public-assets/image.png')), false)
	assert.equal(isPathInsideDirectory(projectDir, resolve('/repo/blog-backup/file.txt')), false)
})
