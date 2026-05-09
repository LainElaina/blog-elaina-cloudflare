import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('wrangler build command uses packageManager-pinned pnpm through corepack', async () => {
	const [packageJsonSource, wranglerConfig] = await Promise.all([
		readFile(new URL('../package.json', import.meta.url), 'utf-8'),
		readFile(new URL('../wrangler.toml', import.meta.url), 'utf-8')
	])
	const packageJson = JSON.parse(packageJsonSource) as { packageManager?: string }

	assert.match(packageJson.packageManager ?? '', /^pnpm@/)
	assert.match(wranglerConfig, /\[build\]\s+command = "corepack pnpm run build:cf"/)
	assert.doesNotMatch(wranglerConfig, /command = "pnpm run build:cf"/)
})
