import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  buildExecuteResponse,
  buildPreviewRouteResponse,
  enforceDevelopmentOnly
} from './blog-migration-route-helper.ts'

describe('blog migration route helper', () => {
  it('非 development 环境会拒绝访问', () => {
    assert.deepEqual(enforceDevelopmentOnly('production'), {
      allowed: false,
      status: 403,
      message: '仅开发环境可用'
    })
  })

  it('preview route 返回 preview payload', () => {
    const response = buildPreviewRouteResponse({
      artifactsToRebuild: ['public/blogs/storage.json']
    })

    assert.equal(response.status, 200)
    assert.deepEqual(response.body.artifactsToRebuild, ['public/blogs/storage.json'])
    assert.match(response.body.notice, /不会修改 Markdown 或图片/)
  })

  it('execute route 在未确认时返回 400', () => {
    const response = buildExecuteResponse({ confirmed: false })
    assert.equal(response.status, 400)
    assert.equal(response.body.message, '执行前需要明确确认')
  })
})
