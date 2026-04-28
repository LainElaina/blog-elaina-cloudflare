import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('site settings shows UTC+8 build completion information under current environment', async () => {
	const [siteSettingsSource, nextConfigSource] = await Promise.all([
		fs.readFile(new URL('./index.tsx', import.meta.url), 'utf-8'),
		fs.readFile(new URL('../../../../../next.config.ts', import.meta.url), 'utf-8')
	])

	assert.match(nextConfigSource, /function formatBuildCompletedAtUtc8\(date: Date\)/)
	assert.match(nextConfigSource, /NEXT_PUBLIC_BUILD_COMPLETED_AT_UTC8: formatBuildCompletedAtUtc8\(new Date\(\)\)/)
	assert.match(nextConfigSource, /UTC\+8/)
	assert.match(siteSettingsSource, /const buildCompletedAtUtc8 = process\.env\.NEXT_PUBLIC_BUILD_COMPLETED_AT_UTC8!/)
	assert.match(siteSettingsSource, /本次构建完成日期：当前处于 corepack pnpm dev 开发模式，未完成构建/)
	assert.match(siteSettingsSource, /本次构建完成日期：\{buildCompletedAtUtc8\}/)
})
