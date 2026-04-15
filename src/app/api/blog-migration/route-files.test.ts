import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { registerHooks } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'

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

async function setupBlogArtifactsRepo() {
  const repoDir = await mkdtemp(join(tmpdir(), 'blog-migration-route-file-'))
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

describe('blog migration next routes', () => {
  it('preview route 返回实际 verify json response', async () => {
    const context = await setupBlogArtifactsRepo()
    const previousNodeEnv = process.env.NODE_ENV
    const previousCwd = process.cwd()

    try {
      process.env.NODE_ENV = 'development'
      process.chdir(context.repoDir)

      const response = await GET()
      const payload = await response.json()

      assert.equal(response.status, 200)
      assert.deepEqual(payload.artifactsToRebuild, ['public/blogs/categories.json', 'public/blogs/storage.json'])
    } finally {
      process.chdir(previousCwd)
      process.env.NODE_ENV = previousNodeEnv
      await context.cleanup()
    }
  })

  it('execute route 未确认时在 development 返回 400', async () => {
    const previousNodeEnv = process.env.NODE_ENV

    try {
      process.env.NODE_ENV = 'development'
      const request = new Request('http://localhost/api/blog-migration/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed: false })
      })
      const response = await POST(request)
      assert.equal(response.status, 400)
    } finally {
      process.env.NODE_ENV = previousNodeEnv
    }
  })

  it('execute route 确认后会真正写入同步与重建结果', async () => {
    const context = await setupBlogArtifactsRepo()
    const previousNodeEnv = process.env.NODE_ENV
    const previousCwd = process.cwd()

    try {
      process.env.NODE_ENV = 'development'
      process.chdir(context.repoDir)

      const request = new Request('http://localhost/api/blog-migration/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed: true })
      })
      const response = await POST(request)
      const payload = await response.json()
      const storageRaw = await readFile(join(context.repoDir, 'public/blogs/storage.json'), 'utf8')

      assert.equal(response.status, 200)
      assert.equal(payload.ok, true)
      assert.deepEqual(payload.artifactsToRebuildAfterExecute, [])
      assert.equal(JSON.parse(storageRaw).blogs['post-a'].slug, 'post-a')
    } finally {
      process.chdir(previousCwd)
      process.env.NODE_ENV = previousNodeEnv
      await context.cleanup()
    }
  })
})
