import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import test from 'node:test'

registerHooks({
	resolve(specifier, context, nextResolve) {
		if (specifier === 'next/server') {
			return nextResolve('next/server.js', context)
		}
		if (specifier === '../local-development-request') {
			return nextResolve('../local-development-request.ts', context)
		}
		return nextResolve(specifier, context)
	}
})

async function withNodeEnv<T>(nodeEnv: string, callback: () => Promise<T>): Promise<T> {
	const previousNodeEnv = process.env.NODE_ENV
	try {
		process.env.NODE_ENV = nodeEnv
		return await callback()
	} finally {
		process.env.NODE_ENV = previousNodeEnv
	}
}

test('save-file wrapper rejects LAN-target development requests before local handler import', async () => {
	await withNodeEnv('development', async () => {
		const { POST } = await import('./route.ts')
		const response = await POST(new Request('http://192.168.1.10:2025/api/save-file', { method: 'POST' }) as any)

		assert.equal(response.status, 403)
		assert.deepEqual(await response.json(), { error: '此接口仅允许本机开发页面调用' })
	})
})
