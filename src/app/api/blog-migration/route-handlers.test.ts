import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { previewRoute, executeRoute } from './route-handlers.ts'

describe('blog migration routes', () => {
  it('preview route 在非 development 环境返回 403', async () => {
    const response = await previewRoute({ nodeEnv: 'production', artifactsToRebuild: [] })
    assert.equal(response.status, 403)
  })

  it('preview route 在 development 环境返回 preview 数据', async () => {
    const response = await previewRoute({
      nodeEnv: 'development',
      artifactsToRebuild: ['public/blogs/storage.json']
    })
    assert.equal(response.status, 200)
    assert.deepEqual(response.body.artifactsToRebuild, ['public/blogs/storage.json'])
  })

  it('execute route 在未确认时返回 400', async () => {
    const response = await executeRoute({ nodeEnv: 'development', confirmed: false })
    assert.equal(response.status, 400)
    assert.equal(response.body.message, '执行前需要明确确认')
  })
})
