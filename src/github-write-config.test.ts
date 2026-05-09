import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('GitHub write config does not silently fall back to a default repository target', async () => {
	const source = await readFile(new URL('./consts.ts', import.meta.url), 'utf-8')

	assert.doesNotMatch(source, /OWNER:\s*process\.env\.NEXT_PUBLIC_GITHUB_OWNER\s*\|\|\s*['"]/)
	assert.doesNotMatch(source, /REPO:\s*process\.env\.NEXT_PUBLIC_GITHUB_REPO\s*\|\|\s*['"]/)
	assert.doesNotMatch(source, /BRANCH:\s*process\.env\.NEXT_PUBLIC_GITHUB_BRANCH\s*\|\|\s*['"]/)
	assert.doesNotMatch(source, /APP_ID:\s*process\.env\.NEXT_PUBLIC_GITHUB_APP_ID\s*\|\|\s*['"]/)
	assert.doesNotMatch(source, /ENCRYPT_KEY:\s*process\.env\.NEXT_PUBLIC_GITHUB_ENCRYPT_KEY\s*\|\|\s*['"]/)
	assert.doesNotMatch(source, /yysuni/)
	assert.doesNotMatch(source, /wudishiduomejimo/)
	assert.match(source, /export function assertGitHubWriteConfigAvailable\(\)/)
})

test('auth checks GitHub write config before using cached tokens', async () => {
	const source = await readFile(new URL('./lib/auth.ts', import.meta.url), 'utf-8')
	const guardIndex = source.indexOf('assertGitHubWriteConfigAvailable()')
	const cacheIndex = source.indexOf('const cachedToken = getTokenFromCache()')

	assert.notEqual(guardIndex, -1)
	assert.notEqual(cacheIndex, -1)
	assert.equal(guardIndex < cacheIndex, true)
})
