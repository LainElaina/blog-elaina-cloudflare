import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { BLOG_MIGRATION_PANEL_MODEL } from './blog-migration-panel-constants.ts'

describe('blog migration panel model', () => {
  it('提供开发工具区标题与 preview/execute 两个动作', () => {
    const model = BLOG_MIGRATION_PANEL_MODEL
    assert.equal(model.title, '博客账本工具')
    assert.equal(model.previewButtonLabel, '预检查')
    assert.equal(model.executeButtonLabel, '执行同步/重建')
  })

  it('execute 动作包含明确确认提示', () => {
    const model = BLOG_MIGRATION_PANEL_MODEL
    assert.match(model.executeConfirmText, /需要明确确认/)
    assert.match(model.executeConfirmText, /不会修改 Markdown 或图片/)
  })
})
