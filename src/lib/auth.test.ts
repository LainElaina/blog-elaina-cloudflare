import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const authSource = readFileSync(new URL('./auth.ts', import.meta.url), 'utf8')
const githubClientSource = readFileSync(new URL('./github-client.ts', import.meta.url), 'utf8')

test('auth modules do not statically import the auth store', () => {
	assert.doesNotMatch(authSource, /import \{ useAuthStore \} from '@\/hooks\/use-auth'/)
	assert.doesNotMatch(githubClientSource, /import \{ useAuthStore \} from '@\/hooks\/use-auth'/)
})
