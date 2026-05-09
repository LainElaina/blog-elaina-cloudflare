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

test('deploy script runs the verified Cloudflare build before deploying', async () => {
	const packageJsonSource = await readFile(new URL('../package.json', import.meta.url), 'utf-8')
	const packageJson = JSON.parse(packageJsonSource) as { scripts?: Record<string, string> }

	assert.equal(packageJson.scripts?.['build:cf'], 'opennextjs-cloudflare build && node scripts/verify-cloudflare-worker-size.js')
	assert.equal(packageJson.scripts?.deploy, 'corepack pnpm run build:cf && opennextjs-cloudflare deploy')
})

test('production build checks TypeScript with build tsconfig', async () => {
	const [nextConfig, buildTsconfig] = await Promise.all([
		readFile(new URL('../next.config.ts', import.meta.url), 'utf-8'),
		readFile(new URL('../tsconfig.build.json', import.meta.url), 'utf-8')
	])

	assert.doesNotMatch(nextConfig, /ignoreBuildErrors:\s*true/)
	assert.match(nextConfig, /tsconfigPath:\s*'tsconfig\.build\.json'/)
	assert.match(buildTsconfig, /src\/\*\*\/\*.tsx/)
	assert.match(buildTsconfig, /src\/\*\*\/\*.test\.ts/)
})

test('production build externalizes local-only API modules', async () => {
	const nextConfig = await readFile(new URL('../next.config.ts', import.meta.url), 'utf-8')

	assert.match(nextConfig, /localOnlyApiModulePattern/)
	assert.equal(nextConfig.includes('\\.\\/route-local'), true)
	assert.equal(nextConfig.includes('\\.\\.\\/route-handlers\\.ts'), true)
	assert.equal(nextConfig.includes('\\.\\.\\/\\.\\.\\/site-config-local-shared\\.ts'), true)
	assert.match(nextConfig, /new webpack\.IgnorePlugin\(\{ resourceRegExp: localOnlyApiModulePattern \}\)/)
})
