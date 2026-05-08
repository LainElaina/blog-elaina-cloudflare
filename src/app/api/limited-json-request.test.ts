import assert from 'node:assert/strict'
import { test } from 'node:test'

import { isJsonRequestBodyTooLargeError, readLimitedJsonRequest } from './limited-json-request.ts'

test('limited JSON request reader parses streaming bodies below byte limit', async () => {
	const request = new Request('http://localhost/api/config', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: '{"ok":true}'
	})

	assert.deepEqual(await readLimitedJsonRequest(request, 12), { ok: true })
})

test('limited JSON request reader accepts streaming bodies exactly at byte limit', async () => {
	const request = new Request('http://localhost/api/config', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: '{"ok":true}'
	})

	assert.deepEqual(await readLimitedJsonRequest(request, 11), { ok: true })
})

test('limited JSON request reader rejects streaming bodies beyond byte limit', async () => {
	const request = new Request('http://localhost/api/config', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ value: 'x'.repeat(16) })
	})

	await assert.rejects(() => readLimitedJsonRequest(request, 8), isJsonRequestBodyTooLargeError)
})

test('limited JSON request reader rejects content-length beyond byte limit before parsing', async () => {
	const request = new Request('http://localhost/api/config', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Content-Length': '9'
		},
		body: '{}'
	})

	await assert.rejects(() => readLimitedJsonRequest(request, 8), isJsonRequestBodyTooLargeError)
})

test('limited JSON request reader ignores invalid content-length while enforcing the stream limit', async () => {
	const request = new Request('http://localhost/api/config', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Content-Length': 'not-a-number'
		},
		body: JSON.stringify({ value: 'x'.repeat(16) })
	})

	await assert.rejects(() => readLimitedJsonRequest(request, 8), isJsonRequestBodyTooLargeError)
})

test('limited JSON request reader ignores negative content-length while enforcing the stream limit', async () => {
	const request = new Request('http://localhost/api/config', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Content-Length': '-1'
		},
		body: JSON.stringify({ value: 'x'.repeat(16) })
	})

	await assert.rejects(() => readLimitedJsonRequest(request, 8), isJsonRequestBodyTooLargeError)
})

test('limited JSON request reader falls back to request json when no stream body is available', async () => {
	let jsonCalled = false
	const request = {
		headers: new Headers({ 'Content-Type': 'application/json' }),
		json: async () => {
			jsonCalled = true
			return { ok: true }
		}
	} as Request

	assert.deepEqual(await readLimitedJsonRequest(request, 8), { ok: true })
	assert.equal(jsonCalled, true)
})

test('limited JSON request reader keeps malformed JSON as a parse error', async () => {
	const request = new Request('http://localhost/api/config', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: '{'
	})

	await assert.rejects(
		() => readLimitedJsonRequest(request, 8),
		error => error instanceof SyntaxError && !isJsonRequestBodyTooLargeError(error)
	)
})
