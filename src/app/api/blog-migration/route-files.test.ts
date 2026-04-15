import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { registerHooks } from 'node:module'

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'next/server') {
      return nextResolve('next/server.js', context)
    }
    return nextResolve(specifier, context)
  }
})

const { GET } = await import('./preview/route.ts')
const { POST } = await import('./execute/route.ts')

describe('blog migration next routes', () => {
  it('preview route 返回 JSON response', async () => {
    const response = await GET()
    assert.equal(typeof response.status, 'number')
  })

  it('execute route 未确认时返回 403', async () => {
    const request = new Request('http://localhost/api/blog-migration/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmed: false })
    })
    const response = await POST(request)
    assert.equal(response.status, 403)
  })
})
