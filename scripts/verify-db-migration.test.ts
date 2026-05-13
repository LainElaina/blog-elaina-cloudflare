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
  it('rejects unknown arguments with a structured failure', async () => {
    await assert.rejects(
      execa('node', ['--import', 'jiti/register', './scripts/verify-db-migration.ts', '--unexpected'], {
        cwd: '/app/blog-elaina-cloudflare'
      }),
      (error: any) => {
        const summary = JSON.parse(error.stdout)
        assert.equal(summary.ok, false)
        assert.equal(summary.operation, 'verify-db-migration')
        assert.equal(summary.code, 'ARGUMENT_INVALID')
        assert.equal(summary.message, '未知参数：--unexpected')
        assert.match(error.stderr, /未知参数：--unexpected/)
        return true
      }
    )
  })

  it('rejects empty base-dir arguments with a structured failure', async () => {
    await assert.rejects(
      execa('node', ['--import', 'jiti/register', './scripts/verify-db-migration.ts', '--base-dir='], {
        cwd: '/app/blog-elaina-cloudflare'
      }),
      (error: any) => {
        const summary = JSON.parse(error.stdout)
        assert.equal(summary.ok, false)
        assert.equal(summary.operation, 'verify-db-migration')
        assert.equal(summary.code, 'ARGUMENT_INVALID')
        assert.equal(summary.message, '--base-dir 需要提供路径值')
        assert.match(error.stderr, /--base-dir 需要提供路径值/)
        return true
      }
    )
  })

  it('reports malformed runtime JSON as a structured artifact failure', async () => {
    const context = await setupRepoWithoutStorage()

    try {
      await writeFile(join(context.repoDir, 'public/blogs/index.json'), '{broken')

      await assert.rejects(
        execa('node', ['--import', 'jiti/register', './scripts/verify-db-migration.ts', `--base-dir=${context.repoDir}`], {
          cwd: '/app/blog-elaina-cloudflare'
        }),
        (error: any) => {
          const summary = JSON.parse(error.stdout)
          assert.equal(summary.ok, false)
          assert.equal(summary.operation, 'verify-db-migration')
          assert.equal(summary.code, 'ARTIFACT_INVALID')
          assert.equal(summary.artifactPath, 'public/blogs/index.json')
          assert.match(summary.message, /博客运行时产物 JSON 无效/)
          assert.match(error.stderr, /博客运行时产物 JSON 无效/)
          return true
        }
      )
    } finally {
      await context.cleanup()
    }
  })

  it('reports missing required runtime artifacts as a structured artifact failure', async () => {
    const context = await setupRepoWithoutStorage()

    try {
      await rm(join(context.repoDir, 'public/blogs/categories.json'))

      await assert.rejects(
        execa('node', ['--import', 'jiti/register', './scripts/verify-db-migration.ts', `--base-dir=${context.repoDir}`], {
          cwd: '/app/blog-elaina-cloudflare'
        }),
        (error: any) => {
          const summary = JSON.parse(error.stdout)
          assert.equal(summary.ok, false)
          assert.equal(summary.operation, 'verify-db-migration')
          assert.equal(summary.code, 'ARTIFACT_MISSING')
          assert.equal(summary.artifactPath, 'public/blogs/categories.json')
          assert.match(summary.message, /缺少博客运行时产物/)
          assert.match(error.stderr, /缺少博客运行时产物/)
          return true
        }
      )
    } finally {
      await context.cleanup()
    }
  })

  it('reports invalid runtime artifact shape as a structured artifact failure', async () => {
    const context = await setupRepoWithoutStorage()

    try {
      await writeFile(join(context.repoDir, 'public/blogs/index.json'), JSON.stringify({ blogs: [] }))

      await assert.rejects(
        execa('node', ['--import', 'jiti/register', './scripts/verify-db-migration.ts', `--base-dir=${context.repoDir}`], {
          cwd: '/app/blog-elaina-cloudflare'
        }),
        (error: any) => {
          const summary = JSON.parse(error.stdout)
          assert.equal(summary.ok, false)
          assert.equal(summary.operation, 'verify-db-migration')
          assert.equal(summary.code, 'ARTIFACT_INVALID')
          assert.equal(summary.artifactPath, 'public/blogs/index.json')
          assert.match(summary.message, /博客运行时产物结构无效/)
          assert.match(error.stderr, /博客运行时产物结构无效/)
          return true
        }
      )
    } finally {
      await context.cleanup()
    }
  })

  it('reports invalid categories artifact shape as a structured artifact failure', async () => {
    const context = await setupRepoWithoutStorage()

    try {
      await writeFile(join(context.repoDir, 'public/blogs/categories.json'), JSON.stringify({ items: [] }))

      await assert.rejects(
        execa('node', ['--import', 'jiti/register', './scripts/verify-db-migration.ts', `--base-dir=${context.repoDir}`], {
          cwd: '/app/blog-elaina-cloudflare'
        }),
        (error: any) => {
          const summary = JSON.parse(error.stdout)
          assert.equal(summary.ok, false)
          assert.equal(summary.operation, 'verify-db-migration')
          assert.equal(summary.code, 'ARTIFACT_INVALID')
          assert.equal(summary.artifactPath, 'public/blogs/categories.json')
          assert.match(summary.message, /博客运行时产物结构无效/)
          assert.match(error.stderr, /博客运行时产物结构无效/)
          return true
        }
      )
    } finally {
      await context.cleanup()
    }
  })

  it('reports invalid folders artifact shape as a structured artifact failure', async () => {
    const context = await setupRepoWithoutStorage()

    try {
      await writeFile(join(context.repoDir, 'public/blogs/folders.json'), JSON.stringify({ folders: [] }))

      await assert.rejects(
        execa('node', ['--import', 'jiti/register', './scripts/verify-db-migration.ts', `--base-dir=${context.repoDir}`], {
          cwd: '/app/blog-elaina-cloudflare'
        }),
        (error: any) => {
          const summary = JSON.parse(error.stdout)
          assert.equal(summary.ok, false)
          assert.equal(summary.operation, 'verify-db-migration')
          assert.equal(summary.code, 'ARTIFACT_INVALID')
          assert.equal(summary.artifactPath, 'public/blogs/folders.json')
          assert.match(summary.message, /博客运行时产物结构无效/)
          assert.match(error.stderr, /博客运行时产物结构无效/)
          return true
        }
      )
    } finally {
      await context.cleanup()
    }
  })

  it('reports invalid storage artifact shape as a structured artifact failure', async () => {
    const context = await setupRepoWithoutStorage()

    try {
      await writeFile(join(context.repoDir, 'public/blogs/storage.json'), JSON.stringify({ blogs: [] }))

      await assert.rejects(
        execa('node', ['--import', 'jiti/register', './scripts/verify-db-migration.ts', `--base-dir=${context.repoDir}`], {
          cwd: '/app/blog-elaina-cloudflare'
        }),
        (error: any) => {
          const summary = JSON.parse(error.stdout)
          assert.equal(summary.ok, false)
          assert.equal(summary.operation, 'verify-db-migration')
          assert.equal(summary.code, 'ARTIFACT_INVALID')
          assert.equal(summary.artifactPath, 'public/blogs/storage.json')
          assert.match(summary.message, /博客运行时产物结构无效/)
          assert.match(error.stderr, /博客运行时产物结构无效/)
          return true
        }
      )
    } finally {
      await context.cleanup()
    }
  })

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
