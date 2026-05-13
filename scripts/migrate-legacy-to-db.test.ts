import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'

import execa from 'execa'

async function setupRepoWithoutStorage() {
  const repoDir = await mkdtemp(join(tmpdir(), 'migrate-legacy-to-db-'))
  const blogsDir = join(repoDir, 'public/blogs')
  await mkdir(blogsDir, { recursive: true })
  await writeFile(
    join(blogsDir, 'index.json'),
    JSON.stringify([
      {
        slug: 'post-a',
        title: 'A',
        tags: [],
        date: '2026-04-13T07:00:00.000Z',
        category: '技术',
        favorite: false
      }
    ], null, 2)
  )
  return {
    repoDir,
    cleanup: async () => rm(repoDir, { recursive: true, force: true })
  }
}

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

  it('does not treat storage read failures other than ENOENT as missing storage', async () => {
    const context = await setupRepoWithoutStorage()

    try {
      await mkdir(join(context.repoDir, 'public/blogs/storage.json'))

      await assert.rejects(
        execa('node', ['--import', 'jiti/register', './scripts/migrate-legacy-to-db.ts', `--base-dir=${context.repoDir}`], {
          cwd: '/app/blog-elaina-cloudflare'
        }),
        (error: any) => {
          assert.equal(error.stdout.trim(), '')
          assert.match(error.stderr, /EISDIR|illegal operation on a directory/)
          return true
        }
      )
    } finally {
      await context.cleanup()
    }
  })
})
