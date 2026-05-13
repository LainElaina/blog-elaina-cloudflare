import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import execa from 'execa'

describe('migrate-legacy-to-db script', () => {
  it('rejects unknown arguments with a structured failure', async () => {
    await assert.rejects(
      execa('node', ['--import', 'jiti/register', './scripts/migrate-legacy-to-db.ts', '--unexpected'], {
        cwd: '/app/blog-elaina-cloudflare'
      }),
      (error: any) => {
        const summary = JSON.parse(error.stdout)
        assert.equal(summary.ok, false)
        assert.equal(summary.operation, 'migrate-legacy-to-db')
        assert.equal(summary.code, 'ARGUMENT_INVALID')
        assert.equal(summary.message, '未知参数：--unexpected')
        assert.match(error.stderr, /未知参数：--unexpected/)
        return true
      }
    )
  })

  it('rejects empty base-dir arguments with a structured failure', async () => {
    await assert.rejects(
      execa('node', ['--import', 'jiti/register', './scripts/migrate-legacy-to-db.ts', '--base-dir='], {
        cwd: '/app/blog-elaina-cloudflare'
      }),
      (error: any) => {
        const summary = JSON.parse(error.stdout)
        assert.equal(summary.ok, false)
        assert.equal(summary.operation, 'migrate-legacy-to-db')
        assert.equal(summary.code, 'ARGUMENT_INVALID')
        assert.equal(summary.message, '--base-dir 需要提供路径值')
        assert.match(error.stderr, /--base-dir 需要提供路径值/)
        return true
      }
    )
  })

  it('rejects database write arguments with a structured failure', async () => {
    await assert.rejects(
      execa('node', ['--import', 'jiti/register', './scripts/migrate-legacy-to-db.ts', '--db-path=/tmp/content.db'], {
        cwd: '/app/blog-elaina-cloudflare'
      }),
      (error: any) => {
        const summary = JSON.parse(error.stdout)
        assert.equal(summary.ok, false)
        assert.equal(summary.operation, 'migrate-legacy-to-db')
        assert.equal(summary.code, 'ARGUMENT_INVALID')
        assert.equal(summary.message, 'migrate-legacy-to-db 仅输出预览，不会写入数据库；请改用重建工具或移除写入参数')
        assert.match(error.stderr, /仅输出预览/)
        return true
      }
    )
  })
})
