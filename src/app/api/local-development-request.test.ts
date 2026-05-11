import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { registerHooks } from 'node:module'
import test from 'node:test'

registerHooks({
	resolve(specifier, context, nextResolve) {
		if (specifier === 'next/server') {
			return nextResolve('next/server.js', context)
		}
		return nextResolve(specifier, context)
	}
})


const localOnlyRouteFiles = [
	'blog-migration/execute/route.ts',
	'blog-migration/preview/route.ts',
	'config/route.ts',
	'delete-dir/route.ts',
	'delete-file/route.ts',
	'delete-image/route.ts',
	'drafts/site-config/route.ts',
	'layout/route.ts',
	'layout/undo/route.ts',
	'publish/site-config/route.ts',
	'save-file/route.ts',
	'share-migration/execute/route.ts',
	'share-migration/preview/route.ts',
	'upload-image/route.ts'
] as const

const localOnlyMigrationRouteFiles = [
	'blog-migration/execute/route.ts',
	'blog-migration/preview/route.ts',
	'share-migration/execute/route.ts',
	'share-migration/preview/route.ts'
] as const

function assertAppearsBefore(source: string, earlier: string, later: string, routeFile: string) {
	const earlierIndex = source.indexOf(earlier)
	const laterIndex = source.indexOf(later)

	assert.notEqual(earlierIndex, -1, `${routeFile} 缺少 ${earlier}`)
	assert.notEqual(laterIndex, -1, `${routeFile} 缺少 ${later}`)
	assert.equal(earlierIndex < laterIndex, true, `${routeFile} 必须先生产环境早退再执行后续本地逻辑`)
}

const { isAllowedLocalDevelopmentRequest, rejectNonLocalDevelopmentRequest } = await import('./local-development-request.ts')

test('development server script binds only to loopback by default', async () => {
	const packageJson = JSON.parse(await readFile(new URL('../../../package.json', import.meta.url), 'utf-8')) as { scripts?: Record<string, string> }
	const devScript = packageJson.scripts?.dev ?? ''

	assert.match(devScript, /(?:^|\s)-H\s+127\.0\.0\.1(?:\s|$)/)
	assert.doesNotMatch(devScript, /(?:^|\s)-H\s+0\.0\.0\.0(?:\s|$)/)
})

function request(url: string, headers?: Record<string, string>) {
	return new Request(url, { headers })
}

test('local development request guard allows same-origin localhost requests', () => {
	assert.equal(isAllowedLocalDevelopmentRequest(request('http://localhost:2025/api/save-file')), true)
	assert.equal(isAllowedLocalDevelopmentRequest(request('http://127.0.0.1:2025/api/save-file', { origin: 'http://127.0.0.1:2025' })), true)
	assert.equal(isAllowedLocalDevelopmentRequest(request('http://[::1]:2025/api/save-file', { 'sec-fetch-site': 'same-origin' })), true)
})

test('local development request guard rejects non-loopback request targets and hosts', () => {
	assert.equal(isAllowedLocalDevelopmentRequest(request('http://192.168.1.10:2025/api/save-file')), false)
	assert.equal(isAllowedLocalDevelopmentRequest(request('http://localhost:2025/api/save-file', { host: '192.168.1.10:2025' })), false)
})

test('local development request guard rejects cross-origin browser submissions', () => {
	assert.equal(isAllowedLocalDevelopmentRequest(request('http://localhost:2025/api/save-file', { origin: 'http://evil.test' })), false)
	assert.equal(isAllowedLocalDevelopmentRequest(request('http://localhost:2025/api/save-file', { 'sec-fetch-site': 'cross-site' })), false)
})

test('rejectNonLocalDevelopmentRequest keeps production blocked before host checks', async () => {
	const previousNodeEnv = process.env.NODE_ENV
	try {
		process.env.NODE_ENV = 'production'
		const response = rejectNonLocalDevelopmentRequest(request('http://localhost:2025/api/save-file'))
		assert.equal(response?.status, 403)
		assert.deepEqual(await response?.json(), { error: '此接口仅在本地开发环境可用' })
	} finally {
		process.env.NODE_ENV = previousNodeEnv
	}
})

test('rejectNonLocalDevelopmentRequest rejects LAN-origin development calls', async () => {
	const previousNodeEnv = process.env.NODE_ENV
	try {
		process.env.NODE_ENV = 'development'
		const response = rejectNonLocalDevelopmentRequest(request('http://192.168.1.10:2025/api/save-file'))
		assert.equal(response?.status, 403)
		assert.deepEqual(await response?.json(), { error: '此接口仅允许本机开发页面调用' })
	} finally {
		process.env.NODE_ENV = previousNodeEnv
	}
})

test('local-only route wrappers return in production before parsing or importing local handlers', async () => {
	for (const routeFile of localOnlyRouteFiles) {
		const source = await readFile(new URL(routeFile, import.meta.url), 'utf-8')
		assertAppearsBefore(source, "if (process.env.NODE_ENV !== 'development')", 'rejectNonLocalDevelopmentRequest(request)', routeFile)

		if (routeFile.endsWith('/execute/route.ts')) {
			assertAppearsBefore(source, "if (process.env.NODE_ENV !== 'development')", 'readLimitedJsonRequest(request', routeFile)
		}

		if (source.includes("await import('./route-local')")) {
			assertAppearsBefore(source, "if (process.env.NODE_ENV !== 'development')", "await import('./route-local')", routeFile)
		}
		if (source.includes("await import('../route-handlers.ts')")) {
			assertAppearsBefore(source, "if (process.env.NODE_ENV !== 'development')", "await import('../route-handlers.ts')", routeFile)
		}
		if (source.includes("await import('../../site-config-local-shared.ts')")) {
			assertAppearsBefore(source, "if (process.env.NODE_ENV !== 'development')", "await import('../../site-config-local-shared.ts')", routeFile)
		}
	}
})

test('local-only wrappers return in production without consuming request bodies', async () => {
	const previousNodeEnv = process.env.NODE_ENV
	try {
		process.env.NODE_ENV = 'production'
		for (const routeFile of localOnlyRouteFiles) {
			const routeModule = await import(`./${routeFile}`)
			if (typeof routeModule.POST !== 'function') {
				continue
			}
			const request = new Request(`http://localhost:2025/api/${routeFile.replace('/route.ts', '')}`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: '{"confirmed":true}'
			}) as any
			const response = await routeModule.POST(request)

			assert.equal(response.status, 403, routeFile)
			assert.deepEqual(await response.json(), { error: '此接口仅在本地开发环境可用' }, routeFile)
			assert.equal(request.bodyUsed, false, routeFile)
		}
	} finally {
		process.env.NODE_ENV = previousNodeEnv
	}
})

test('local-only migration routes pass real node env to inner handlers', async () => {
	for (const routeFile of localOnlyMigrationRouteFiles) {
		const source = await readFile(new URL(routeFile, import.meta.url), 'utf-8')
		assert.match(source, /nodeEnv:\s*process\.env\.NODE_ENV/)
		assert.doesNotMatch(source, /nodeEnv:\s*['"]development['"]/, `${routeFile} 不应向内部迁移 handler 传入硬编码 development`)
	}
})
