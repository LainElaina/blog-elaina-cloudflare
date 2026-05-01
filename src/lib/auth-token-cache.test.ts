import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('auth caches installation tokens with expiry metadata', async () => {
	const source = (await fs.readFile(new URL('./auth.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	assert.match(source, /import \{ createInstallationToken, getInstallationId, signAppJwt, type InstallationToken \} from '\.\/github-client'/)
	assert.match(source, /const TOKEN_EXPIRY_BUFFER_MS = 5 \* 60 \* 1000/)
	assert.match(source, /const cachedToken = JSON\.parse\(cachedValue\) as Partial<InstallationToken>/)
	assert.match(source, /typeof cachedToken\.token !== 'string' \|\| typeof cachedToken\.expiresAt !== 'string'/)
	assert.match(source, /const expiresAtMs = Date\.parse\(cachedToken\.expiresAt\)/)
	assert.match(source, /!Number\.isFinite\(expiresAtMs\) \|\| expiresAtMs - Date\.now\(\) <= TOKEN_EXPIRY_BUFFER_MS/)
	assert.match(source, /sessionStorage\.setItem\(GITHUB_TOKEN_CACHE_KEY, JSON\.stringify\(token\)\)/)
	assert.match(source, /const installationToken = await createInstallationToken\(jwt, installationId\)\n\n\s*saveTokenToCache\(installationToken\)\n\n\s*return installationToken\.token/)
	assert.doesNotMatch(source, /return sessionStorage\.getItem\(GITHUB_TOKEN_CACHE_KEY\)/)
	assert.doesNotMatch(source, /saveTokenToCache\(token: string\)/)
})

test('github client preserves installation token expiry from GitHub', async () => {
	const source = (await fs.readFile(new URL('./github-client.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	assert.match(source, /export interface InstallationToken \{\n\s*token: string\n\s*expiresAt: string\n\}/)
	assert.match(source, /export async function createInstallationToken\(jwt: string, installationId: number\): Promise<InstallationToken>/)
	assert.match(source, /typeof data\?\.token !== 'string' \|\| typeof data\?\.expires_at !== 'string'/)
	assert.match(source, /return \{ token: data\.token, expiresAt: data\.expires_at \}/)
	assert.doesNotMatch(source, /return data\.token as string/)
})
