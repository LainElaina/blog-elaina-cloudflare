import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { LIKE_ENDPOINT, postLike } from './like-button-model.ts'

function createJsonResponse(ok: boolean, body: unknown) {
	return {
		ok,
		json: async () => body
	}
}

describe('like button model', () => {
	it('posts encoded slug and returns server count on success', async () => {
		const calls: Array<{ input: string; method: string }> = []
		const result = await postLike('文章 / A', async (input, init) => {
			calls.push({ input, method: init.method })
			return createJsonResponse(true, { count: 12 })
		})

		assert.deepEqual(result, { ok: true, count: 12 })
		assert.deepEqual(calls, [
			{
				input: `${LIKE_ENDPOINT}?slug=${encodeURIComponent('文章 / A')}`,
				method: 'POST'
			}
		])
	})

	it('does not treat HTTP failure as a successful like', async () => {
		const result = await postLike('post-a', async () => createJsonResponse(false, { count: 13 }))

		assert.deepEqual(result, { ok: false })
	})

	it('does not fallback-increment when the like response has no count', async () => {
		const result = await postLike('post-a', async () => createJsonResponse(true, {}))

		assert.deepEqual(result, { ok: false })
	})

	it('reports rate limit as a failed like without a count', async () => {
		const result = await postLike('post-a', async () => createJsonResponse(false, { reason: 'rate_limited', count: 13 }))

		assert.deepEqual(result, { ok: false, reason: 'rate_limited' })
	})
})
