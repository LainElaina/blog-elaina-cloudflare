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

const SHARE_ARTIFACT_PATHS = {
  list: 'public/share/list.json',
  categories: 'public/share/categories.json',
  folders: 'public/share/folders.json',
  storage: 'public/share/storage.json'
} as const

async function setupShareArtifactsRepo() {
  const repoDir = await mkdtemp(join(tmpdir(), 'share-migration-route-file-'))
  const shareDir = join(repoDir, 'public/share')

  await mkdir(shareDir, { recursive: true })
  await writeFile(
    join(shareDir, 'list.json'),
    JSON.stringify(
      [
        {
          name: 'Alpha',
          logo: '/alpha.png',
          url: 'https://alpha.dev',
          description: 'alpha',
          tags: ['tool'],
          stars: 4,
          category: '设计',
          folderPath: '/收藏/工具'
        }
      ],
      null,
      2
    )
  )
  await writeFile(join(shareDir, 'categories.json'), JSON.stringify({ categories: [] }, null, 2))
  await writeFile(join(shareDir, 'folders.json'), JSON.stringify([], null, 2))
  await writeFile(
    join(shareDir, 'storage.json'),
    JSON.stringify(
      {
        version: 1,
        updatedAt: '2026-04-19T00:00:00.000Z',
        shares: {}
      },
      null,
      2
    )
  )

  return {
    repoDir,
    cleanup: async () => rm(repoDir, { recursive: true, force: true })
  }
}

function restoreNodeEnv(previousNodeEnv: string | undefined) {
  if (previousNodeEnv === undefined) {
    delete process.env.NODE_ENV
    return
  }

  process.env.NODE_ENV = previousNodeEnv
}

describe('share migration next routes', () => {
  it('preview route 返回实际 preview handler json response', async () => {
    const context = await setupShareArtifactsRepo()
    const previousNodeEnv = process.env.NODE_ENV
    const previousCwd = process.cwd()

    try {
      process.env.NODE_ENV = 'development'
      process.chdir(context.repoDir)

      const response = await GET()
      const payload = await response.json()

      assert.equal(response.status, 200)
      assert.equal(payload.ok, true)
      assert.equal(payload.operation, 'preview')
      assert.deepEqual(payload.artifactsToRebuild, [
        SHARE_ARTIFACT_PATHS.categories,
        SHARE_ARTIFACT_PATHS.folders,
        SHARE_ARTIFACT_PATHS.storage
      ])
    } finally {
      process.chdir(previousCwd)
      restoreNodeEnv(previousNodeEnv)
      await context.cleanup()
    }
  })

  it('execute route 缺少 confirmation 时在 development 返回 400', async () => {
    const previousNodeEnv = process.env.NODE_ENV

    try {
      process.env.NODE_ENV = 'development'

      const request = new Request('http://localhost/api/share-migration/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      const response = await POST(request)
      const payload = await response.json()

      assert.equal(response.status, 400)
      assert.deepEqual(payload, {
        ok: false,
        operation: 'execute',
        code: 'UNCONFIRMED',
        message: '执行前需要明确确认'
      })
    } finally {
      restoreNodeEnv(previousNodeEnv)
    }
  })

  it('execute route body=null 时走既有未确认分支而不是崩溃', async () => {
    const previousNodeEnv = process.env.NODE_ENV

    try {
      process.env.NODE_ENV = 'development'

      const request = new Request('http://localhost/api/share-migration/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'null'
      })
      const response = await POST(request)
      const payload = await response.json()

      assert.equal(response.status, 400)
      assert.deepEqual(payload, {
        ok: false,
        operation: 'execute',
        code: 'UNCONFIRMED',
        message: '执行前需要明确确认'
      })
    } finally {
      restoreNodeEnv(previousNodeEnv)
    }
  })

  it('execute route confirmed=true 时返回 200 并写入重建结果', async () => {
    const context = await setupShareArtifactsRepo()
    const previousNodeEnv = process.env.NODE_ENV
    const previousCwd = process.cwd()

    try {
      process.env.NODE_ENV = 'development'
      process.chdir(context.repoDir)

      const request = new Request('http://localhost/api/share-migration/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed: true })
      })
      const response = await POST(request)
      const payload = await response.json()
      const storageRaw = await readFile(join(context.repoDir, SHARE_ARTIFACT_PATHS.storage), 'utf8')

      assert.equal(response.status, 200)
      assert.equal(payload.ok, true)
      assert.equal(payload.operation, 'execute')
      assert.deepEqual(payload.writtenArtifacts, [
        SHARE_ARTIFACT_PATHS.list,
        SHARE_ARTIFACT_PATHS.categories,
        SHARE_ARTIFACT_PATHS.folders,
        SHARE_ARTIFACT_PATHS.storage
      ])
      assert.deepEqual(payload.artifactsToRebuildAfterExecute, [])
      assert.equal(JSON.parse(storageRaw).shares.alpha?.slug, 'alpha')
    } finally {
      process.chdir(previousCwd)
      restoreNodeEnv(previousNodeEnv)
      await context.cleanup()
    }
  })
})
