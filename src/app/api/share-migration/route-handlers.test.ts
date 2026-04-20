import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { describe, it } from 'node:test'

import { executeRoute, previewRoute } from './route-handlers.ts'

type ShareRepoSetupOptions = {
  omitArtifacts?: Array<'list' | 'categories' | 'folders' | 'storage'>
  invalidJsonArtifacts?: Array<'list' | 'categories' | 'folders' | 'storage'>
  malformedArtifacts?: Partial<Record<'list' | 'categories' | 'folders' | 'storage', string>>
}

const SHARE_ARTIFACT_PATHS = {
  list: 'public/share/list.json',
  categories: 'public/share/categories.json',
  folders: 'public/share/folders.json',
  storage: 'public/share/storage.json'
} as const

function createBaseArtifacts() {
  return {
    list: JSON.stringify(
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
    ),
    categories: JSON.stringify({ categories: [] }, null, 2),
    folders: JSON.stringify([], null, 2),
    storage: JSON.stringify(
      {
        version: 1,
        updatedAt: '2026-04-19T00:00:00.000Z',
        shares: {}
      },
      null,
      2
    )
  }
}

async function setupShareArtifactsRepo(options: ShareRepoSetupOptions = {}) {
  const repoDir = await mkdtemp(join(tmpdir(), 'share-migration-route-'))
  const shareDir = join(repoDir, 'public/share')
  const artifacts = createBaseArtifacts()

  await mkdir(shareDir, { recursive: true })

  for (const artifactName of Object.keys(artifacts) as Array<keyof typeof artifacts>) {
    if (options.omitArtifacts?.includes(artifactName)) {
      continue
    }

    const nextContent = options.invalidJsonArtifacts?.includes(artifactName)
      ? '{'
      : options.malformedArtifacts?.[artifactName] ?? artifacts[artifactName]

    await writeFile(join(shareDir, `${artifactName}.json`), nextContent)
  }

  return {
    repoDir,
    cleanup: async () => rm(repoDir, { recursive: true, force: true })
  }
}

describe('share migration route handlers', () => {
  it('preview rejects non-development requests', async () => {
    const response = await previewRoute({
      nodeEnv: 'production',
      baseDir: '/tmp/unused-share-migration'
    })

    assert.equal(response.status, 403)
    assert.deepEqual(response.body, {
      ok: false,
      operation: 'preview',
      code: 'DEV_ONLY',
      message: '仅开发环境可用'
    })
  })

  it('preview strictly reads artifacts and returns the real artifactsToRebuild list', async () => {
    const context = await setupShareArtifactsRepo()

    try {
      const response = await previewRoute({
        nodeEnv: 'development',
        baseDir: context.repoDir
      })

      assert.equal(response.status, 200)
      assert.equal(response.body.ok, true)
      assert.equal(response.body.operation, 'preview')
      assert.match(response.body.summary, /待重建 share 正式产物/)
      assert.equal(response.body.notice, '只处理 share 正式产物，不会修改 logo 图片。预检查基于当前磁盘快照。')
      assert.deepEqual(response.body.artifactsToRebuild, [
        SHARE_ARTIFACT_PATHS.categories,
        SHARE_ARTIFACT_PATHS.folders,
        SHARE_ARTIFACT_PATHS.storage
      ])
    } finally {
      await context.cleanup()
    }
  })

  it('preview returns a structured missing-artifact error', async () => {
    const context = await setupShareArtifactsRepo({
      omitArtifacts: ['storage']
    })

    try {
      const response = await previewRoute({
        nodeEnv: 'development',
        baseDir: context.repoDir
      })

      assert.equal(response.status, 400)
      assert.deepEqual(response.body, {
        ok: false,
        operation: 'preview',
        code: 'ARTIFACT_MISSING',
        message: '缺少 share 正式产物：public/share/storage.json',
        details: {
          artifact: SHARE_ARTIFACT_PATHS.storage
        }
      })
    } finally {
      await context.cleanup()
    }
  })

  it('preview returns a structured invalid-json error', async () => {
    const context = await setupShareArtifactsRepo({
      invalidJsonArtifacts: ['list']
    })

    try {
      const response = await previewRoute({
        nodeEnv: 'development',
        baseDir: context.repoDir
      })

      assert.equal(response.status, 400)
      assert.equal(response.body.ok, false)
      assert.equal(response.body.operation, 'preview')
      assert.equal(response.body.code, 'ARTIFACT_INVALID_JSON')
      assert.equal(response.body.message, 'public/share/list.json 不是合法 JSON')
      assert.deepEqual(response.body.details, {
        artifact: SHARE_ARTIFACT_PATHS.list
      })
    } finally {
      await context.cleanup()
    }
  })

  it('preview returns a structured invalid-shape error', async () => {
    const context = await setupShareArtifactsRepo({
      malformedArtifacts: {
        categories: JSON.stringify({ categories: [1] }, null, 2)
      }
    })

    try {
      const response = await previewRoute({
        nodeEnv: 'development',
        baseDir: context.repoDir
      })

      assert.equal(response.status, 400)
      assert.equal(response.body.ok, false)
      assert.equal(response.body.operation, 'preview')
      assert.equal(response.body.code, 'ARTIFACT_INVALID_SHAPE')
      assert.equal(response.body.message, 'public/share/categories.json 的内容结构不合法')
      assert.deepEqual(response.body.details, {
        artifact: SHARE_ARTIFACT_PATHS.categories
      })
    } finally {
      await context.cleanup()
    }
  })

  it('execute rejects false, string, number, null, and missing confirmations before touching disk', async () => {
    for (const confirmed of [false, 'true', 1, null, undefined]) {
      let readCalled = false
      let writeCalled = false

      const response = await executeRoute({
        nodeEnv: 'development',
        confirmed,
        baseDir: '/tmp/unused-share-migration',
        readText: async () => {
          readCalled = true
          throw new Error('readText should not be called')
        },
        writeText: async () => {
          writeCalled = true
          throw new Error('writeText should not be called')
        }
      })

      assert.equal(response.status, 400)
      assert.deepEqual(response.body, {
        ok: false,
        operation: 'execute',
        code: 'UNCONFIRMED',
        message: '执行前需要明确确认'
      })
      assert.equal(readCalled, false)
      assert.equal(writeCalled, false)
    }
  })

  it('execute writes artifacts in fixed order and verifies the post-write disk state', async () => {
    const context = await setupShareArtifactsRepo()
    const writeOrder: string[] = []

    try {
      const response = await executeRoute({
        nodeEnv: 'development',
        confirmed: true,
        baseDir: context.repoDir,
        writeText: async (filePath, content) => {
          const artifactPath = relative(context.repoDir, filePath)
          writeOrder.push(artifactPath)
          await writeFile(filePath, content)

          if (artifactPath === SHARE_ARTIFACT_PATHS.storage) {
            await writeFile(join(context.repoDir, SHARE_ARTIFACT_PATHS.categories), JSON.stringify({ categories: [] }, null, 2))
          }
        }
      })

      assert.equal(response.status, 200)
      assert.equal(response.body.ok, true)
      assert.equal(response.body.operation, 'execute')
      assert.match(response.body.summary, /已重建 share 正式产物/)
      assert.equal(response.body.notice, '只处理 share 正式产物，不会修改 logo 图片。执行结果已基于写回后的磁盘状态复检。')
      assert.deepEqual(writeOrder, [
        SHARE_ARTIFACT_PATHS.list,
        SHARE_ARTIFACT_PATHS.categories,
        SHARE_ARTIFACT_PATHS.folders,
        SHARE_ARTIFACT_PATHS.storage
      ])
      assert.deepEqual(response.body.writtenArtifacts, writeOrder)
      assert.deepEqual(response.body.artifactsToRebuildBeforeExecute, [
        SHARE_ARTIFACT_PATHS.categories,
        SHARE_ARTIFACT_PATHS.folders,
        SHARE_ARTIFACT_PATHS.storage
      ])
      assert.deepEqual(response.body.artifactsToRebuildAfterExecute, [SHARE_ARTIFACT_PATHS.categories])

      const categoriesRaw = await readFile(join(context.repoDir, SHARE_ARTIFACT_PATHS.categories), 'utf8')
      const foldersRaw = await readFile(join(context.repoDir, SHARE_ARTIFACT_PATHS.folders), 'utf8')
      const storageRaw = await readFile(join(context.repoDir, SHARE_ARTIFACT_PATHS.storage), 'utf8')

      assert.deepEqual(JSON.parse(categoriesRaw), { categories: [] })
      assert.deepEqual(JSON.parse(foldersRaw), [
        {
          name: '收藏',
          path: '/收藏',
          children: [
            {
              name: '工具',
              path: '/收藏/工具',
              children: []
            }
          ]
        }
      ])
      assert.equal(JSON.parse(storageRaw).shares.alpha?.slug, 'alpha')
    } finally {
      await context.cleanup()
    }
  })

  it('execute returns WRITE_FAILED with partial write details on injected mid-write failure', async () => {
    const context = await setupShareArtifactsRepo()
    const writeOrder: string[] = []

    try {
      const response = await executeRoute({
        nodeEnv: 'development',
        confirmed: true,
        baseDir: context.repoDir,
        writeText: async (filePath, content) => {
          const artifactPath = relative(context.repoDir, filePath)
          writeOrder.push(artifactPath)

          if (artifactPath === SHARE_ARTIFACT_PATHS.folders) {
            throw new Error('simulated folders write failure')
          }

          await writeFile(filePath, content)
        }
      })

      assert.deepEqual(writeOrder, [
        SHARE_ARTIFACT_PATHS.list,
        SHARE_ARTIFACT_PATHS.categories,
        SHARE_ARTIFACT_PATHS.folders
      ])
      assert.equal(response.status, 500)
      assert.deepEqual(response.body, {
        ok: false,
        operation: 'execute',
        code: 'WRITE_FAILED',
        message: '写入 share 正式产物失败：public/share/folders.json',
        writtenArtifactsPartial: [
          SHARE_ARTIFACT_PATHS.list,
          SHARE_ARTIFACT_PATHS.categories
        ],
        shouldRepreview: true,
        details: {
          artifact: SHARE_ARTIFACT_PATHS.folders
        }
      })

      const listRaw = await readFile(join(context.repoDir, SHARE_ARTIFACT_PATHS.list), 'utf8')
      const categoriesRaw = await readFile(join(context.repoDir, SHARE_ARTIFACT_PATHS.categories), 'utf8')
      const foldersRaw = await readFile(join(context.repoDir, SHARE_ARTIFACT_PATHS.folders), 'utf8')
      const storageRaw = await readFile(join(context.repoDir, SHARE_ARTIFACT_PATHS.storage), 'utf8')

      assert.equal(JSON.parse(listRaw)[0].folderPath, '/收藏/工具')
      assert.deepEqual(JSON.parse(categoriesRaw), { categories: ['设计'] })
      assert.deepEqual(JSON.parse(foldersRaw), [])
      assert.deepEqual(JSON.parse(storageRaw).shares, {})
    } finally {
      await context.cleanup()
    }
  })
})
