import assert from 'node:assert/strict'
import { test } from 'node:test'

import { isJsonRequestBodyTooLargeError, readLimitedJsonRequest } from './limited-json-request.ts'

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
