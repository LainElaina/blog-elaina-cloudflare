import assert from 'node:assert/strict'
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

const { isAllowedLocalDevelopmentRequest, rejectNonLocalDevelopmentRequest } = await import('./local-development-request.ts')

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
