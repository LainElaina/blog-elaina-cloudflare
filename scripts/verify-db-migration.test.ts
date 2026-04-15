import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'

import execa from 'execa'

async function setupRepoWithoutStorage() {
  const repoDir = await mkdtemp(join(tmpdir(), 'verify-db-migration-'))
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
  await writeFile(join(blogsDir, 'categories.json'), JSON.stringify({ categories: [] }, null, 2))
  await writeFile(join(blogsDir, 'folders.json'), JSON.stringify([], null, 2))
  return {
    repoDir,
    cleanup: async () => rm(repoDir, { recursive: true, force: true })
  }
}

describe('verify-db-migration script', () => {
  it('在 storage.json 缺失时不会因 ENOENT 崩溃，而是输出 verify 结果并报告待重建产物', async () => {
    const context = await setupRepoWithoutStorage()

    try {
      await assert.rejects(
        execa('node', ['--import', 'jiti/register', './scripts/verify-db-migration.ts', `--base-dir=${context.repoDir}`], {
          cwd: '/app/blog-elaina-cloudflare'
        }),
        (error: any) => {
          assert.match(error.stderr, /博客正式产物与账本不一致/)
          const summary = JSON.parse(error.stdout)
          assert.deepEqual(summary.verify.artifactsToRebuild, ['public/blogs/storage.json', 'public/blogs/categories.json'])
          assert.equal(summary.verify.touchesMarkdown, false)
          assert.equal(summary.verify.touchesImages, false)
          return true
        }
      )
    } finally {
      await context.cleanup()
    }
  })
})
