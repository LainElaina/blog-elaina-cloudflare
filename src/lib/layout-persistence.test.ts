import assert from 'node:assert/strict'
import { test } from 'node:test'

import { loadLayoutFromServer, saveLayoutToServer, undoLayout } from './layout-persistence.ts'

type FetchCall = { input: string | URL | Request; init?: RequestInit }

async function withNodeEnv<T>(nodeEnv: string, run: () => Promise<T>): Promise<T> {
	const previousNodeEnv = process.env.NODE_ENV
	try {
		process.env.NODE_ENV = nodeEnv
		return await run()
	} finally {
		process.env.NODE_ENV = previousNodeEnv
	}
}

function stubFetch(responseBody: unknown) {
	const calls: FetchCall[] = []
	const previousFetch = globalThis.fetch
	globalThis.fetch = async (input, init) => {
		calls.push({ input, init })
		return new Response(JSON.stringify(responseBody), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		})
	}
	return {
		calls,
		restore: () => {
			globalThis.fetch = previousFetch
		}
	}
}

test('layout persistence does not call local API outside development', async () => {
	const fetchStub = stubFetch({ ok: true })
	try {
		await withNodeEnv('production', async () => {
			await assert.rejects(() => saveLayoutToServer({}), /仅在本地开发环境可用/)
			await assert.rejects(() => loadLayoutFromServer(), /仅在本地开发环境可用/)
			await assert.rejects(() => undoLayout(), /仅在本地开发环境可用/)
		})
		assert.equal(fetchStub.calls.length, 0)
	} finally {
		fetchStub.restore()
	}
})

test('layout persistence keeps using local API in development', async () => {
	const fetchStub = stubFetch({ ok: true })
	try {
		await withNodeEnv('development', async () => {
			await saveLayoutToServer({ clockCard: { width: 1 } })
			await loadLayoutFromServer()
			await undoLayout()
		})
		assert.deepEqual(
			fetchStub.calls.map(call => [String(call.input), call.init?.method ?? 'GET']),
			[
				['/api/layout', 'POST'],
				['/api/layout', 'GET'],
				['/api/layout/undo', 'POST']
			]
		)
	} finally {
		fetchStub.restore()
	}
})
