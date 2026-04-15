import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'

import { previewRoute, executeRoute } from './route-handlers.ts'

async function setupBlogArtifactsRepo() {
  const repoDir = await mkdtemp(join(tmpdir(), 'blog-migration-route-'))
  const blogsDir = join(repoDir, 'public/blogs')

  await mkdir(blogsDir, { recursive: true })
  await writeFile(
    join(blogsDir, 'index.json'),
    JSON.stringify(
      [
        {
          slug: 'post-a',
          title: 'A',
          tags: [],
          date: '2026-04-13T07:00:00.000Z',
          category: '技术',
          favorite: false
        }
      ],
      null,
      2
    )
  )
  await writeFile(join(blogsDir, 'categories.json'), JSON.stringify({ categories: [] }, null, 2))
  await writeFile(join(blogsDir, 'folders.json'), JSON.stringify([], null, 2))

  return {
    repoDir,
    cleanup: async () => rm(repoDir, { recursive: true, force: true })
  }
}

describe('blog migration routes', () => {
  it('preview route 在非 development 环境返回 403', async () => {
    const response = await previewRoute({ nodeEnv: 'production', baseDir: '/tmp/unused-blog-migration' })
    assert.equal(response.status, 403)
  })

  it('preview route 在 development 环境返回实际 verify 结果', async () => {
    const context = await setupBlogArtifactsRepo()

    try {
      const response = await previewRoute({
        nodeEnv: 'development',
        baseDir: context.repoDir
      })

      assert.equal(response.status, 200)
      assert.deepEqual(response.body.artifactsToRebuild, ['public/blogs/categories.json', 'public/blogs/storage.json'])
    } finally {
      await context.cleanup()
    }
  })

  it('execute route 在未确认时返回 400', async () => {
    const response = await executeRoute({ nodeEnv: 'development', confirmed: false, baseDir: '/tmp/unused-blog-migration' })
    assert.equal(response.status, 400)
    assert.equal(response.body.message, '执行前需要明确确认')
  })

  it('execute route 在确认后会同步账本并重建正式产物', async () => {
    const context = await setupBlogArtifactsRepo()

    try {
      const response = await executeRoute({
        nodeEnv: 'development',
        confirmed: true,
        baseDir: context.repoDir
      })

      assert.equal(response.status, 200)
      assert.equal(response.body.ok, true)
      assert.deepEqual(response.body.writtenArtifacts, [
        'public/blogs/index.json',
        'public/blogs/categories.json',
        'public/blogs/folders.json',
        'public/blogs/storage.json'
      ])
      assert.deepEqual(response.body.artifactsToRebuildAfterExecute, [])

      const categoriesRaw = await readFile(join(context.repoDir, 'public/blogs/categories.json'), 'utf8')
      const storageRaw = await readFile(join(context.repoDir, 'public/blogs/storage.json'), 'utf8')

      assert.deepEqual(JSON.parse(categoriesRaw), { categories: ['技术'] })
      assert.equal(JSON.parse(storageRaw).blogs['post-a'].slug, 'post-a')
    } finally {
      await context.cleanup()
    }
  })
})
